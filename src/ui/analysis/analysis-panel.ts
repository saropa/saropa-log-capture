/** Cross-session analysis panel — progressive rendering with cancellation. */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import { getNonce } from '../provider/viewer-content';
import { openLogAtLine } from '../../modules/search/log-search';
import { extractAnalysisTokens } from '../../modules/analysis/line-analyzer';
import { extractSourceReference } from '../../modules/source/source-linker';
import { parseSourceTag } from '../../modules/source/source-tag-parser';
import { extractFrames, analyzeFrame } from './analysis-frame-handler';
import type { SectionData } from '../../modules/analysis/analysis-relevance';
import { type RelatedLinesResult, scanRelatedLines } from '../../modules/analysis/related-lines-scanner';
import { renderRelatedLinesSection } from './analysis-related-render';
import { getCrashEvents } from '../../modules/crashlytics/firebase-crashlytics';
import { getIssueStats } from '../../modules/crashlytics/crashlytics-stats';
import { renderCrashDetail, renderDeviceDistribution, renderApiDistribution } from './analysis-crash-detail';
import { generateCrashSummary } from '../../modules/crashlytics/crashlytics-ai-summary';
import { mergeResults, postPendingSlots, postFinalization } from './analysis-panel-helpers';
import { buildProgressiveShell, emptySlot } from './analysis-panel-render';
import {
    type StreamCtx,
    runSourceChain, runDocsScan, runSymbolResolution, runTokenSearch,
    runCrossSessionLookup, runReferencedFiles, runGitHubLookup, runFirebaseLookup,
} from './analysis-panel-streams';
import { classifyLevel, isActionableLevel } from '../../modules/analysis/level-classifier';
import { buildErrorContext, runTriageLookup, runErrorTimeline, runOccurrenceScan } from './analysis-error-streams';
import { handleTriageToggle, handleCopyContext, handleBugReport, handleExportAction, handleAiExplain } from './analysis-error-actions';

let panel: vscode.WebviewPanel | undefined;
let activeAbort: AbortController | undefined;
let lastFileUri: vscode.Uri | undefined;
const streamTimeout = 15_000;

function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

let lastLineText = '';
let lastErrorHash = '';

/** Run analysis for a log line and show results in the panel. */
export async function showAnalysis(lineText: string, lineIndex?: number, fileUri?: vscode.Uri): Promise<void> {
    const tokens = extractAnalysisTokens(lineText);
    if (tokens.length === 0) {
        vscode.window.showInformationMessage(t('msg.noAnalyzableTokens'));
        return;
    }
    cancelAnalysis();
    const abort = new AbortController();
    activeAbort = abort;

    // Detect if this is an error/warning line
    const level = classifyLevel(lineText, 'stdout', false);
    const isError = isActionableLevel(level) && (level === 'error' || level === 'warning');
    const errCtx = isError ? buildErrorContext(lineText, undefined) : undefined;
    lastLineText = lineText;
    lastErrorHash = errCtx?.hash ?? '';

    ensurePanel();
    lastFileUri = fileUri;
    const sourceRef = extractSourceReference(lineText);
    const sourceToken = tokens.find(t => t.type === 'source-file');
    const sourceTag = parseSourceTag(lineText);
    const frames = await extractFrames(fileUri, lineIndex);
    const hasTag = !!sourceTag;
    panel!.webview.html = buildProgressiveShell({
        nonce: getNonce(), lineText, tokens, hasSource: !!sourceRef,
        frames: frames.length > 0 ? frames : undefined, hasTag,
        isError, errorHash: errCtx?.hash,
    });

    const posted = new Set<string>();
    const post = (id: string, html: string): void => {
        posted.add(id);
        if (!abort.signal.aborted) { panel?.webview.postMessage({ type: 'sectionReady', id, html }); }
    };

    // Wave 1: quick related-lines scan enriches tokens for all subsequent streams
    let related: RelatedLinesResult | undefined;
    if (sourceTag && fileUri) {
        related = await raceTimeout(scanRelatedLines(fileUri, sourceTag, lineIndex ?? -1), 5000).catch(() => undefined);
    }
    if (abort.signal.aborted) { return; }
    const allTokens = related?.enhancedTokens?.length ? related.enhancedTokens : tokens;
    if (related) { post('related', renderRelatedLinesSection(related, lineIndex ?? -1)); }
    else if (hasTag) { post('related', emptySlot('related', '📋 No related lines found')); }

    // Wave 2: all streams in parallel with enriched tokens + error streams
    const ctx: StreamCtx = { post, signal: abort.signal, progress: postProgress };
    const errorStreams = errCtx ? [
        raceTimeout(runTriageLookup(ctx, lineText, errCtx), streamTimeout),
        raceTimeout(runErrorTimeline(ctx, errCtx), streamTimeout),
        raceTimeout(runOccurrenceScan(ctx, errCtx, fileUri), streamTimeout),
    ] : [];
    const results = await Promise.allSettled([
        raceTimeout(runSourceChain(ctx, sourceToken?.value, sourceRef?.line), streamTimeout),
        raceTimeout(runDocsScan(ctx, allTokens), streamTimeout),
        raceTimeout(runSymbolResolution(ctx, allTokens), streamTimeout),
        raceTimeout(runTokenSearch(ctx, allTokens), streamTimeout),
        raceTimeout(runCrossSessionLookup(postProgress, lineText), streamTimeout),
        raceTimeout(runReferencedFiles(ctx, related), streamTimeout),
        raceTimeout(runGitHubLookup(ctx, related, allTokens), streamTimeout),
        raceTimeout(runFirebaseLookup(ctx, allTokens), streamTimeout),
        ...errorStreams,
    ]);
    if (abort.signal.aborted) { return; }
    postPendingSlots(posted, post, { hasSource: !!sourceRef, hasTag, hasError: errCtx !== undefined });
    const relatedMetrics: Partial<SectionData> = related ? { relatedLineCount: related.lines.length } : {};
    postFinalization(post, mergeResults(results, relatedMetrics), abort.signal, panel);
}
/** Dispose the singleton panel. */
export function disposeAnalysisPanel(): void { cancelAnalysis(); panel?.dispose(); panel = undefined; }
function cancelAnalysis(): void { activeAbort?.abort(); activeAbort = undefined; }
function postProgress(id: string, message: string): void {
    panel?.webview.postMessage({ type: 'sectionProgress', id, message });
}

async function fetchCrashDetail(issueId: string, eventIndex = 0): Promise<void> {
    const multi = await getCrashEvents(issueId).catch(() => undefined);
    if (!multi || multi.events.length === 0) {
        panel?.webview.postMessage({ type: 'crashDetailReady', issueId, html: '<div class="no-matches">Crash details not available</div>' });
        return;
    }
    const idx = Math.max(0, Math.min(eventIndex, multi.events.length - 1));
    const detail = multi.events[idx];
    const html = renderCrashDetail(detail);
    const dist = renderDeviceDistribution(multi);
    const nav = multi.events.length > 1 ? `<div class="crash-event-nav" data-issue-id="${issueId}"><button class="crash-nav-btn" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>&lt;</button> <span class="crash-nav-label">Event ${idx + 1} of ${multi.events.length}</span> <button class="crash-nav-btn" data-dir="1" ${idx >= multi.events.length - 1 ? 'disabled' : ''}>&gt;</button></div>` : '';
    const statsSlot = `<div id="crash-stats-${issueId}"></div>`;
    panel?.webview.postMessage({ type: 'crashDetailReady', issueId, html: statsSlot + dist + nav + html });
    // AI summary — async, arrives after the initial render.
    generateCrashSummary(detail).then(summary => {
        if (summary) { panel?.webview.postMessage({ type: 'crashAiSummary', issueId, html: `<div class="crash-ai-summary">${escapeHtml(summary)}</div>` }); }
    }).catch(() => {});
    // Aggregate stats — async, cached per issue to avoid redundant API calls on event nav.
    getIssueStats(issueId).then(stats => {
        if (stats) { panel?.webview.postMessage({ type: 'issueStatsReady', issueId, html: renderApiDistribution(stats) }); }
    }).catch(() => {});
}
function postFrameResult(file: string, line: number, html: string): void {
    panel?.webview.postMessage({ type: 'frameReady', file, line, html });
}
function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.analysis', 'Saropa Line Analysis',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { cancelAnalysis(); panel = undefined; });
}

function handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'cancelAnalysis') { cancelAnalysis(); return; }
    if (msg.type === 'analyzeFrame') { analyzeFrame(String(msg.file ?? ''), Number(msg.line ?? 1), postFrameResult).catch(() => {}); return; }
    if (msg.type === 'fetchCrashDetail') { fetchCrashDetail(String(msg.issueId ?? ''), Number(msg.eventIndex ?? 0)).catch(() => {}); return; }
    if (msg.type === 'navigateCrashEvent') { fetchCrashDetail(String(msg.issueId ?? ''), Number(msg.eventIndex ?? 0)).catch(() => {}); return; }
    // Error action bar handlers
    if (msg.type === 'setTriageStatus') {
        const post = (id: string, html: string): void => { panel?.webview.postMessage({ type: 'sectionReady', id, html }); };
        handleTriageToggle(String(msg.hash ?? ''), String(msg.status ?? 'open'), post).catch(() => {});
        return;
    }
    if (msg.type === 'copyErrorContext') { handleCopyContext(lastLineText, lastErrorHash).catch(() => {}); return; }
    if (msg.type === 'generateBugReport') { handleBugReport(lastLineText, 0, lastFileUri).catch(() => {}); return; }
    if (msg.type === 'exportError') { handleExportAction(String(msg.format ?? '')); return; }
    if (msg.type === 'aiExplain') { handleAiExplain(lastLineText); return; }
    if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        openLogAtLine(match).catch(() => {});
    } else if (msg.type === 'openSource' || msg.type === 'openDoc') {
        const uri = vscode.Uri.parse(String(msg.uri));
        const line = Number(msg.line ?? 1);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
    } else if (msg.type === 'openRelatedLine' && lastFileUri) {
        const ln = Number(msg.line ?? 0);
        vscode.window.showTextDocument(lastFileUri, { selection: new vscode.Range(ln, 0, ln, 0) });
    } else if (msg.type === 'openGitHubUrl' || msg.type === 'openFirebaseUrl') {
        vscode.env.openExternal(vscode.Uri.parse(String(msg.url))).then(undefined, () => {});
    }
}
