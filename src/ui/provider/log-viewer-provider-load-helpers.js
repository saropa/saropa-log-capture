"use strict";
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
exports.loadUnifiedSessionJsonlContent = loadUnifiedSessionJsonlContent;
exports.loadPerfAndCodeQualityPayload = loadPerfAndCodeQualityPayload;
exports.truncateMainContentLines = truncateMainContentLines;
exports.buildMainCtx = buildMainCtx;
exports.getMainBaseFromFsPath = getMainBaseFromFsPath;
exports.collectViewerSourcesForSidecars = collectViewerSourcesForSidecars;
exports.appendTerminalSidecarLines = appendTerminalSidecarLines;
exports.appendExternalSidecarLines = appendExternalSidecarLines;
exports.postRunBoundariesIfAny = postRunBoundariesIfAny;
exports.postCorrelationByLineIndex = postCorrelationByLineIndex;
exports.getSmartBookmarksFirstErrorAndWarning = getSmartBookmarksFirstErrorAndWarning;
const vscode = __importStar(require("vscode"));
const config_1 = require("../../modules/config/config");
const session_metadata_1 = require("../../modules/session/session-metadata");
const unified_session_log_writer_1 = require("../../modules/session/unified-session-log-writer");
const viewer_file_loader_1 = require("../viewer/viewer-file-loader");
const run_boundaries_1 = require("../../modules/session/run-boundaries");
const session_severity_counts_1 = require("../session/session-severity-counts");
const run_summaries_1 = require("../../modules/session/run-summaries");
const viewer_content_1 = require("./viewer-content");
const first_error_1 = require("../../modules/bookmarks/first-error");
const helpers = __importStar(require("./viewer-provider-helpers"));
const root_cause_hint_drift_meta_1 = require("../../modules/root-cause-hints/root-cause-hint-drift-meta");
const drift_advisor_db_panel_load_1 = require("../../modules/integrations/drift-advisor-db-panel-load");
async function loadUnifiedSessionJsonlContent(target, uri, text, checkGen) {
    const cfgUnified = (0, config_1.getConfig)();
    const effectiveUnified = (0, viewer_content_1.getEffectiveViewerLines)(cfgUnified.maxLines, cfgUnified.viewerMaxLines ?? 0);
    target.setSessionInfo(null);
    const postUnified = (msg) => { if (checkGen()) {
        target.postMessage(msg);
    } };
    let sessionMidnightMs = 0;
    try {
        const mainLogPath = uri.fsPath.slice(0, -unified_session_log_writer_1.UNIFIED_SESSION_LOG_SUFFIX.length) + ".log";
        const mainRaw = await vscode.workspace.fs.readFile(vscode.Uri.file(mainLogPath));
        const mainFields = (0, viewer_file_loader_1.parseHeaderFields)(Buffer.from(mainRaw).toString("utf-8").split(/\r?\n/));
        sessionMidnightMs = (0, viewer_file_loader_1.computeSessionMidnight)(mainFields["Date"] ?? "");
    }
    catch {
        sessionMidnightMs = 0;
    }
    const unifiedBaseCtx = { classifyFrame: (t) => helpers.classifyFrame(t), sessionMidnightMs };
    const unifiedRawLines = [];
    for (const line of text.split(/\r?\n/)) {
        if (line.trim() === '') {
            continue;
        }
        try {
            const obj = JSON.parse(line);
            if (typeof obj?.source === 'string' && typeof obj?.text === 'string') {
                unifiedRawLines.push(obj.text);
            }
        }
        catch {
            // ignore malformed jsonl records
        }
    }
    const { lines: unifiedAll, sources: unifiedSources } = (0, viewer_file_loader_1.parseUnifiedJsonlToPending)(text, unifiedBaseCtx);
    let unifiedLines = unifiedAll;
    let unifiedRawLinesForView = unifiedRawLines;
    if (unifiedLines.length > effectiveUnified) {
        unifiedLines = unifiedLines.slice(0, effectiveUnified);
        unifiedRawLinesForView = unifiedRawLines.slice(0, unifiedLines.length);
        postUnified({ type: "loadTruncated", shown: effectiveUnified, total: unifiedAll.length });
    }
    postUnified({ type: "setSources", sources: unifiedSources, enabledSources: [...unifiedSources] });
    await (0, viewer_file_loader_1.sendPendingLinesBatched)(unifiedLines, postUnified, target.getSeenCategories());
    if (!checkGen()) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    postRunBoundariesIfAny(unifiedRawLinesForView, { sessionMidnightMs }, postUnified);
    const smart = getSmartBookmarksFirstErrorAndWarning(cfgUnified, unifiedRawLinesForView);
    if (target.setHasPerformanceData) {
        target.setHasPerformanceData(false);
    }
    if (target.setCodeQualityPayload) {
        target.setCodeQualityPayload(null);
    }
    postUnified({ type: "setDriftAdvisorDbPanelMeta", payload: null });
    postUnified({ type: "loadComplete" });
    return { sessionMidnightMs, contentLength: unifiedLines.length, ...smart };
}
async function loadPerfAndCodeQualityPayload(_target, uri, checkGen) {
    let hasPerf = false;
    let codeQualityPayload = undefined;
    let rootCauseDriftAdvisorSummary;
    let driftAdvisorDbPanelPayload = null;
    try {
        if (!checkGen()) {
            return { cancelled: true, hasPerf: false, codeQualityPayload: undefined, driftAdvisorDbPanelPayload: null };
        }
        const meta = await new session_metadata_1.SessionMetadataStore().loadMetadata(uri);
        if (!checkGen()) {
            return { cancelled: true, hasPerf: false, codeQualityPayload: undefined, driftAdvisorDbPanelPayload: null };
        }
        hasPerf = (0, session_metadata_1.hasMeaningfulPerformanceData)(meta.integrations?.performance);
        const cq = meta.integrations?.codeQuality;
        if (cq && typeof cq === "object" && cq !== null && "files" in cq) {
            codeQualityPayload = cq;
        }
        const drift = (0, root_cause_hint_drift_meta_1.rootCauseDriftSummaryFromSessionIntegrations)(meta.integrations);
        if (drift) {
            rootCauseDriftAdvisorSummary = drift;
        }
        driftAdvisorDbPanelPayload = await (0, drift_advisor_db_panel_load_1.loadDriftAdvisorDbPanelPayload)(uri, meta.integrations);
    }
    catch {
        // ignore
    }
    return { cancelled: false, hasPerf, codeQualityPayload, rootCauseDriftAdvisorSummary, driftAdvisorDbPanelPayload };
}
function truncateMainContentLines(rawLines) {
    const headerEnd = (0, viewer_file_loader_1.findHeaderEnd)(rawLines);
    let contentLines = rawLines.slice(headerEnd);
    const cfg = (0, config_1.getConfig)();
    const truncatedShown = (0, viewer_content_1.getEffectiveViewerLines)(cfg.maxLines, cfg.viewerMaxLines ?? 0);
    const didTruncate = contentLines.length > truncatedShown;
    if (didTruncate) {
        contentLines = contentLines.slice(0, truncatedShown);
    }
    return { headerEnd, contentLines, didTruncate, truncatedShown };
}
function buildMainCtx(fields, source) {
    return { classifyFrame: (t) => helpers.classifyFrame(t), sessionMidnightMs: (0, viewer_file_loader_1.computeSessionMidnight)(fields["Date"] ?? ""), source };
}
function getMainBaseFromFsPath(fsPath) {
    return (fsPath.split(/[/\\]/).pop() ?? "").replace(/\.[^.]+$/, "") || "log";
}
function collectViewerSourcesForSidecars(mainBase, terminalSidecar, externalSidecars) {
    const sources = [viewer_file_loader_1.SOURCE_DEBUG];
    if (terminalSidecar) {
        sources.push(viewer_file_loader_1.SOURCE_TERMINAL);
    }
    for (const sidecarUri of externalSidecars) {
        const label = (0, viewer_file_loader_1.externalSidecarLabelFromFileName)(mainBase, sidecarUri.fsPath.split(/[/\\]/).pop() ?? "");
        const sourceId = "external:" + label;
        if (!sources.includes(sourceId)) {
            sources.push(sourceId);
        }
    }
    return sources;
}
async function appendTerminalSidecarLines(opts) {
    const { terminalSidecar, totalLineCount, checkGen, post, target } = opts;
    if (!terminalSidecar) {
        return { cancelled: false, totalLineCount };
    }
    try {
        const termRaw = await vscode.workspace.fs.readFile(terminalSidecar);
        if (!checkGen()) {
            return { cancelled: true, totalLineCount };
        }
        const termLines = (0, viewer_file_loader_1.parseTerminalSidecarToPending)(Buffer.from(termRaw).toString("utf-8"));
        if (termLines.length > 0 && checkGen()) {
            const nextCount = totalLineCount + termLines.length;
            post({ type: "addLines", lines: termLines, lineCount: nextCount });
            helpers.sendNewCategories(termLines, target.getSeenCategories(), (m) => post(m));
            return { cancelled: false, totalLineCount: nextCount };
        }
    }
    catch {
        // ignore sidecar read failure
    }
    return { cancelled: false, totalLineCount };
}
async function appendExternalSidecarLines(opts) {
    const { externalSidecars, mainBase, totalLineCount, checkGen, post, target } = opts;
    let currentCount = totalLineCount;
    for (const sidecarUri of externalSidecars) {
        try {
            const raw = await vscode.workspace.fs.readFile(sidecarUri);
            if (!checkGen()) {
                return { cancelled: true, totalLineCount: currentCount };
            }
            const sidecarName = sidecarUri.fsPath.split(/[/\\]/).pop() ?? "";
            const label = (0, viewer_file_loader_1.externalSidecarLabelFromFileName)(mainBase, sidecarName);
            const extLines = (0, viewer_file_loader_1.parseExternalSidecarToPending)(Buffer.from(raw).toString("utf-8"), label);
            if (extLines.length > 0 && checkGen()) {
                currentCount += extLines.length;
                post({ type: "addLines", lines: extLines, lineCount: currentCount });
                helpers.sendNewCategories(extLines, target.getSeenCategories(), (m) => post(m));
            }
        }
        catch {
            // skip unreadable sidecar
        }
    }
    return { cancelled: !checkGen(), totalLineCount: currentCount };
}
function postRunBoundariesIfAny(contentLines, ctx, post) {
    const boundaries = (0, run_boundaries_1.detectRunBoundaries)(contentLines);
    const runStartIndices = (0, run_boundaries_1.getRunStartIndices)(boundaries);
    if (runStartIndices.length === 0) {
        return;
    }
    const getTimestampForLine = (raw) => {
        const m = /^\[([\d:.]+)\]/.exec(raw);
        return m ? (0, viewer_file_loader_1.parseTimeToMs)(m[1], ctx.sessionMidnightMs) : 0;
    };
    const countSeveritiesForSlice = (lines) => {
        const c = (0, session_severity_counts_1.countSeverities)(lines.join("\n"));
        return { errors: c.errors, warnings: c.warnings, perfs: c.perfs, infos: c.infos };
    };
    const runSummaries = (0, run_summaries_1.getRunSummaries)(contentLines, runStartIndices, getTimestampForLine, countSeveritiesForSlice);
    post({ type: "runBoundaries", boundaries, runStartIndices, runSummaries });
}
function postCorrelationByLineIndex(opts) {
    const { uri, byLoc, headerEnd, contentLinesLength, post } = opts;
    const correlationByLineIndex = {};
    const uriStr = uri.toString();
    for (const [key, value] of byLoc) {
        const colon = key.indexOf(":");
        if (colon === -1 || key.slice(0, colon) !== uriStr) {
            continue;
        }
        const line = Number.parseInt(key.slice(colon + 1), 10);
        const contentIdx = line - 1 - headerEnd;
        if (Number.isFinite(line) && contentIdx >= 0 && contentIdx < contentLinesLength) {
            correlationByLineIndex[contentIdx] = value;
        }
    }
    if (Object.keys(correlationByLineIndex).length > 0) {
        post({ type: "setCorrelationByLineIndex", correlationByLineIndex });
    }
}
function getSmartBookmarksFirstErrorAndWarning(cfg, contentLines) {
    if (!cfg.smartBookmarks.suggestFirstError && !cfg.smartBookmarks.suggestFirstWarning) {
        return {};
    }
    const found = (0, first_error_1.findFirstErrorLines)(contentLines, {
        strict: cfg.levelDetection === "strict",
        includeWarning: cfg.smartBookmarks.suggestFirstWarning,
    });
    return { firstError: found.firstError, firstWarning: found.firstWarning };
}
//# sourceMappingURL=log-viewer-provider-load-helpers.js.map