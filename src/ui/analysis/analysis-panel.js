"use strict";
/** Cross-session analysis panel — progressive rendering with cancellation. */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.showAnalysis = showAnalysis;
exports.disposeAnalysisPanel = disposeAnalysisPanel;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const ansi_1 = require("../../modules/capture/ansi");
const viewer_content_1 = require("../provider/viewer-content");
const log_search_1 = require("../../modules/search/log-search");
const line_analyzer_1 = require("../../modules/analysis/line-analyzer");
const source_linker_1 = require("../../modules/source/source-linker");
const source_tag_parser_1 = require("../../modules/source/source-tag-parser");
const analysis_frame_handler_1 = require("./analysis-frame-handler");
const related_lines_scanner_1 = require("../../modules/analysis/related-lines-scanner");
const analysis_related_render_1 = require("./analysis-related-render");
const firebase_crashlytics_1 = require("../../modules/crashlytics/firebase-crashlytics");
const crashlytics_stats_1 = require("../../modules/crashlytics/crashlytics-stats");
const analysis_crash_detail_1 = require("./analysis-crash-detail");
const crashlytics_ai_summary_1 = require("../../modules/crashlytics/crashlytics-ai-summary");
const analysis_panel_helpers_1 = require("./analysis-panel-helpers");
const analysis_panel_render_1 = require("./analysis-panel-render");
const analysis_panel_streams_1 = require("./analysis-panel-streams");
const level_classifier_1 = require("../../modules/analysis/level-classifier");
const analysis_error_streams_1 = require("./analysis-error-streams");
const analysis_error_actions_1 = require("./analysis-error-actions");
let panel;
let activeAbort;
let lastFileUri;
const streamTimeout = 15_000;
function raceTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
let lastLineText = '';
let lastErrorHash = '';
let lastLineIndex = 0;
/** Run analysis for a log line and show results in the panel. */
async function showAnalysis(lineText, lineIndex, fileUri) {
    const tokens = (0, line_analyzer_1.extractAnalysisTokens)(lineText);
    if (tokens.length === 0) {
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.noAnalyzableTokens'));
        return;
    }
    cancelAnalysis();
    const abort = new AbortController();
    activeAbort = abort;
    const level = (0, level_classifier_1.classifyLevel)(lineText, 'stdout', false);
    const isError = (0, level_classifier_1.isActionableLevel)(level) && (level === 'error' || level === 'warning');
    const errCtx = isError ? (0, analysis_error_streams_1.buildErrorContext)(lineText, undefined) : undefined;
    lastLineText = lineText;
    lastErrorHash = errCtx?.hash ?? '';
    lastLineIndex = lineIndex ?? 0;
    ensurePanel();
    lastFileUri = fileUri;
    const sourceRef = (0, source_linker_1.extractSourceReference)(lineText);
    const sourceTag = (0, source_tag_parser_1.parseSourceTag)(lineText);
    const frames = await (0, analysis_frame_handler_1.extractFrames)(fileUri, lineIndex);
    panel.webview.html = (0, analysis_panel_render_1.buildProgressiveShell)({
        nonce: (0, viewer_content_1.getNonce)(), lineText, tokens, hasSource: !!sourceRef,
        frames: frames.length > 0 ? frames : undefined, hasTag: !!sourceTag,
        isError, errorHash: errCtx?.hash,
    });
    await runAnalysisWaves({ abort, lineText, lineIndex: lineIndex ?? -1, tokens, sourceRef, sourceTag, fileUri, errCtx });
}
/** Execute wave 1 (related-lines) and wave 2 (parallel streams). */
async function runAnalysisWaves(w) {
    const { abort, lineIndex, sourceRef, sourceTag, fileUri, errCtx, tokens } = w;
    const posted = new Set();
    const post = (id, html) => {
        posted.add(id);
        if (!abort.signal.aborted) {
            panel?.webview.postMessage({ type: 'sectionReady', id, html });
        }
    };
    const hasTag = !!sourceTag;
    let related;
    if (sourceTag && fileUri) {
        related = await raceTimeout((0, related_lines_scanner_1.scanRelatedLines)(fileUri, sourceTag, lineIndex), 5000).catch(() => undefined);
    }
    if (abort.signal.aborted) {
        return;
    }
    const allTokens = related?.enhancedTokens?.length ? related.enhancedTokens : tokens;
    if (related) {
        post('related', (0, analysis_related_render_1.renderRelatedLinesSection)(related, lineIndex));
    }
    else if (hasTag) {
        post('related', (0, analysis_panel_render_1.emptySlot)('related', '📋 No related lines found'));
    }
    const ctx = { post, signal: abort.signal, progress: postProgress };
    const results = await Promise.allSettled(buildStreamPromises(ctx, w, allTokens, related));
    if (abort.signal.aborted) {
        return;
    }
    (0, analysis_panel_helpers_1.postPendingSlots)(posted, post, { hasSource: !!sourceRef, hasTag, hasError: errCtx !== undefined });
    const relatedMetrics = related ? { relatedLineCount: related.lines.length } : {};
    (0, analysis_panel_helpers_1.postFinalization)(post, (0, analysis_panel_helpers_1.mergeResults)(results, relatedMetrics), abort.signal, panel);
}
/** Build the array of parallel stream promises for wave 2. */
function buildStreamPromises(ctx, w, allTokens, related) {
    const sourceToken = w.tokens.find(tk => tk.type === 'source-file');
    return [
        raceTimeout((0, analysis_panel_streams_1.runSourceChain)(ctx, sourceToken?.value, w.sourceRef?.line), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runDocsScan)(ctx, allTokens), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runSymbolResolution)(ctx, allTokens), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runTokenSearch)(ctx, allTokens), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runCrossSessionLookup)(postProgress, w.lineText), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runReferencedFiles)(ctx, related), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runGitHubLookup)(ctx, related, allTokens), streamTimeout),
        raceTimeout((0, analysis_panel_streams_1.runFirebaseLookup)(ctx, allTokens), streamTimeout),
        ...(w.errCtx ? [
            raceTimeout((0, analysis_error_streams_1.runTriageLookup)(ctx, w.lineText, w.errCtx), streamTimeout),
            raceTimeout((0, analysis_error_streams_1.runErrorTimeline)(ctx, w.errCtx), streamTimeout),
            raceTimeout((0, analysis_error_streams_1.runOccurrenceScan)(ctx, w.errCtx, w.fileUri), streamTimeout),
        ] : []),
    ];
}
/** Dispose the singleton panel. */
function disposeAnalysisPanel() { cancelAnalysis(); panel?.dispose(); panel = undefined; }
function cancelAnalysis() { activeAbort?.abort(); activeAbort = undefined; }
function postProgress(id, message) {
    panel?.webview.postMessage({ type: 'sectionProgress', id, message });
}
async function fetchCrashDetail(issueId, eventIndex = 0) {
    const multi = await (0, firebase_crashlytics_1.getCrashEvents)(issueId).catch(() => undefined);
    if (!multi || multi.events.length === 0) {
        panel?.webview.postMessage({ type: 'crashDetailReady', issueId, html: '<div class="no-matches">Crash details not available</div>' });
        return;
    }
    const idx = Math.max(0, Math.min(eventIndex, multi.events.length - 1));
    const detail = multi.events[idx];
    const html = (0, analysis_crash_detail_1.renderCrashDetail)(detail);
    const dist = (0, analysis_crash_detail_1.renderDeviceDistribution)(multi);
    const nav = multi.events.length > 1 ? `<div class="crash-event-nav" data-issue-id="${issueId}"><button class="crash-nav-btn" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>&lt;</button> <span class="crash-nav-label">Event ${idx + 1} of ${multi.events.length}</span> <button class="crash-nav-btn" data-dir="1" ${idx >= multi.events.length - 1 ? 'disabled' : ''}>&gt;</button></div>` : '';
    const statsSlot = `<div id="crash-stats-${issueId}"></div>`;
    panel?.webview.postMessage({ type: 'crashDetailReady', issueId, html: statsSlot + dist + nav + html });
    // AI summary — async, arrives after the initial render.
    (0, crashlytics_ai_summary_1.generateCrashSummary)(detail).then(summary => {
        if (summary) {
            panel?.webview.postMessage({ type: 'crashAiSummary', issueId, html: `<div class="crash-ai-summary">${(0, ansi_1.escapeHtml)(summary)}</div>` });
        }
    }).catch(() => { });
    // Aggregate stats — async, cached per issue to avoid redundant API calls on event nav.
    (0, crashlytics_stats_1.getIssueStats)(issueId).then(stats => {
        if (stats) {
            panel?.webview.postMessage({ type: 'issueStatsReady', issueId, html: (0, analysis_crash_detail_1.renderApiDistribution)(stats) });
        }
    }).catch(() => { });
}
function postFrameResult(file, line, html) {
    panel?.webview.postMessage({ type: 'frameReady', file, line, html });
}
function ensurePanel() {
    if (panel) {
        panel.reveal();
        return;
    }
    panel = vscode.window.createWebviewPanel('saropaLogCapture.analysis', 'Saropa Line Analysis', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { cancelAnalysis(); panel = undefined; });
}
function handleMessage(msg) {
    if (msg.type === 'cancelAnalysis') {
        cancelAnalysis();
        return;
    }
    if (msg.type === 'analyzeFrame') {
        (0, analysis_frame_handler_1.analyzeFrame)(String(msg.file ?? ''), Number(msg.line ?? 1), postFrameResult).catch(() => { });
        return;
    }
    if (msg.type === 'fetchCrashDetail') {
        fetchCrashDetail(String(msg.issueId ?? ''), Number(msg.eventIndex ?? 0)).catch(() => { });
        return;
    }
    if (msg.type === 'navigateCrashEvent') {
        fetchCrashDetail(String(msg.issueId ?? ''), Number(msg.eventIndex ?? 0)).catch(() => { });
        return;
    }
    // Error action bar handlers
    if (msg.type === 'setTriageStatus') {
        (0, analysis_error_actions_1.handleTriageToggle)(String(msg.hash ?? ''), String(msg.status ?? 'open')).catch(() => { });
        return;
    }
    if (msg.type === 'copyErrorContext') {
        (0, analysis_error_actions_1.handleCopyContext)(lastLineText, lastErrorHash).catch(() => { });
        return;
    }
    if (msg.type === 'generateBugReport') {
        (0, analysis_error_actions_1.handleBugReport)(lastLineText, lastLineIndex, lastFileUri).catch(() => { });
        return;
    }
    if (msg.type === 'exportError') {
        (0, analysis_error_actions_1.handleExportAction)(String(msg.format ?? ''));
        return;
    }
    if (msg.type === 'aiExplain') {
        (0, analysis_error_actions_1.handleAiExplain)(lastLineText);
        return;
    }
    if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        (0, log_search_1.openLogAtLine)(match).catch(() => { });
    }
    else if (msg.type === 'openSource' || msg.type === 'openDoc') {
        const uri = vscode.Uri.parse(String(msg.uri));
        const line = Number(msg.line ?? 1);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
    }
    else if (msg.type === 'openRelatedLine' && lastFileUri) {
        const ln = Number(msg.line ?? 0);
        vscode.window.showTextDocument(lastFileUri, { selection: new vscode.Range(ln, 0, ln, 0) });
    }
    else if (msg.type === 'openGitHubUrl' || msg.type === 'openFirebaseUrl') {
        vscode.env.openExternal(vscode.Uri.parse(String(msg.url))).then(undefined, () => { });
    }
}
//# sourceMappingURL=analysis-panel.js.map