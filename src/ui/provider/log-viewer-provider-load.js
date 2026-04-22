"use strict";
/**
 * Load-from-file and tail watcher logic for LogViewerProvider.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */
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
exports.detectFileMode = detectFileMode;
exports.executeLoadContent = executeLoadContent;
exports.createTailWatcher = createTailWatcher;
const vscode = __importStar(require("vscode"));
const unified_session_log_writer_1 = require("../../modules/session/unified-session-log-writer");
const config_1 = require("../../modules/config/config");
const viewer_file_loader_1 = require("../viewer/viewer-file-loader");
const helpers = __importStar(require("./viewer-provider-helpers"));
const correlation_store_1 = require("../../modules/correlation/correlation-store");
const context_loader_1 = require("../../modules/context/context-loader");
const log_viewer_provider_load_helpers_1 = require("./log-viewer-provider-load-helpers");
const log_viewer_provider_load_parts_1 = require("./log-viewer-provider-load-parts");
/** Detect the viewer file mode from extension. Non-log modes skip the analysis pipeline. */
function detectFileMode(uri) {
    const ext = uri.fsPath.toLowerCase().split('.').pop();
    switch (ext) {
        case 'md': return 'markdown';
        case 'json':
        case 'jsonl': return 'json';
        case 'csv': return 'csv';
        case 'html':
        case 'htm': return 'html';
        default: return 'log';
    }
}
/**
 * Execute the core load: read file, parse header, send content lines, run boundaries.
 * Returns { sessionMidnightMs, contentLength, firstError?, firstWarning? } for optional tailing and smart bookmarks.
 */
async function executeLoadContent(target, uri, checkGen) {
    const raw = await vscode.workspace.fs.readFile(uri);
    if (!checkGen()) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    const text = Buffer.from(raw).toString("utf-8");
    target.postMessage({ type: "setViewingMode", viewing: true });
    target.setFilename(vscode.workspace.asRelativePath(uri, false));
    /* Notify the webview of the file mode so it can skip log analysis for
       structured documents (markdown, JSON, CSV, HTML). Sent before lines
       so the mode is set when addToData() receives the first line. */
    const fileMode = detectFileMode(uri);
    target.postMessage({ type: "setFileMode", mode: fileMode });
    if (uri.fsPath.toLowerCase().endsWith(unified_session_log_writer_1.UNIFIED_SESSION_LOG_SUFFIX.toLowerCase())) {
        return await (0, log_viewer_provider_load_helpers_1.loadUnifiedSessionJsonlContent)(target, uri, text, checkGen);
    }
    const sessionParts = await (0, log_viewer_provider_load_parts_1.readSessionLogParts)(uri, text);
    const fields = (0, viewer_file_loader_1.parseHeaderFields)(sessionParts[0].lines);
    if (Object.keys(fields).length > 0) {
        target.setSessionInfo(fields);
    }
    const perfResult = await (0, log_viewer_provider_load_helpers_1.loadPerfAndCodeQualityPayload)(target, uri, checkGen);
    if (perfResult.cancelled) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    if (target.setHasPerformanceData) {
        target.setHasPerformanceData(perfResult.hasPerf);
    }
    if (target.setCodeQualityPayload && perfResult.codeQualityPayload) {
        target.setCodeQualityPayload(perfResult.codeQualityPayload);
    }
    if (checkGen()) {
        target.postMessage({
            type: "setRootCauseHintHostFields",
            driftAdvisorSummary: perfResult.rootCauseDriftAdvisorSummary ?? null,
            sessionDiffSummary: null,
        });
        target.postMessage({
            type: "setDriftAdvisorDbPanelMeta",
            payload: perfResult.driftAdvisorDbPanelPayload ?? null,
        });
    }
    const contentLines = [];
    for (const part of sessionParts) {
        const headerEndForPart = (0, viewer_file_loader_1.findHeaderEnd)(part.lines);
        contentLines.push(...part.lines.slice(headerEndForPart));
    }
    const cfg = (0, config_1.getConfig)();
    // Status-bar level filters operate on in-memory allLines, so keep MAX_LINES high enough
    // for the full loaded session (including split parts) instead of trimming to viewer default.
    target.postMessage({ type: "setMaxLines", maxLines: Math.max(contentLines.length + 1000, cfg.maxLines) });
    const post = (msg) => { if (checkGen()) {
        target.postMessage(msg);
    } };
    const ctx = (0, log_viewer_provider_load_helpers_1.buildMainCtx)(fields, viewer_file_loader_1.SOURCE_DEBUG);
    // Source filter: default to debug only; terminal sidecar (if present) adds a second source.
    post({ type: "setSources", sources: [viewer_file_loader_1.SOURCE_DEBUG], enabledSources: [viewer_file_loader_1.SOURCE_DEBUG] });
    await (0, viewer_file_loader_1.sendFileLines)(contentLines, ctx, post, target.getSeenCategories());
    if (!checkGen()) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    const sidecarUris = await (0, context_loader_1.findSidecarUris)(uri);
    const terminalSidecar = sidecarUris.find((u) => u.fsPath.endsWith(".terminal.log"));
    const browserSidecar = sidecarUris.find((u) => u.fsPath.endsWith(".browser.json"));
    const externalSidecars = sidecarUris.filter((u) => u.fsPath.endsWith(".log") && !u.fsPath.endsWith(".terminal.log"));
    const mainBase = (0, log_viewer_provider_load_helpers_1.getMainBaseFromFsPath)(uri.fsPath);
    const sources = (0, log_viewer_provider_load_helpers_1.collectViewerSourcesForSidecars)(mainBase, terminalSidecar, externalSidecars, browserSidecar);
    if (sources.length > 1) {
        post({ type: "setSources", sources: [...sources], enabledSources: [...sources] });
    }
    const totalLineCount = contentLines.length;
    const terminalRes = await (0, log_viewer_provider_load_helpers_1.appendTerminalSidecarLines)({
        terminalSidecar,
        totalLineCount,
        checkGen,
        post,
        target,
    });
    if (terminalRes.cancelled) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    const externalRes = await (0, log_viewer_provider_load_helpers_1.appendExternalSidecarLines)({
        externalSidecars,
        mainBase,
        totalLineCount: terminalRes.totalLineCount,
        checkGen,
        post,
        target,
    });
    if (externalRes.cancelled) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    const browserRes = await (0, log_viewer_provider_load_helpers_1.appendBrowserSidecarLines)({
        browserSidecar,
        totalLineCount: externalRes.totalLineCount,
        checkGen,
        post,
        target,
    });
    if (browserRes.cancelled) {
        return { sessionMidnightMs: 0, contentLength: 0 };
    }
    (0, log_viewer_provider_load_helpers_1.postRunBoundariesIfAny)(contentLines, ctx, post);
    // Map correlation data to content line index for viewer badges (main log only; key is "file:line").
    const byLoc = (0, correlation_store_1.getCorrelationByLocation)(uri.toString());
    (0, log_viewer_provider_load_helpers_1.postCorrelationByLineIndex)({
        uri,
        byLoc: byLoc,
        headerEnd: (0, viewer_file_loader_1.findHeaderEnd)(sessionParts[0].lines),
        contentLinesLength: contentLines.length,
        post,
    });
    const smart = (0, log_viewer_provider_load_helpers_1.getSmartBookmarksFirstErrorAndWarning)(cfg, contentLines);
    target.postMessage({ type: "loadComplete" });
    return {
        sessionMidnightMs: ctx.sessionMidnightMs,
        contentLength: contentLines.length,
        ...(smart.firstError && { firstError: smart.firstError }),
        ...(smart.firstWarning && { firstWarning: smart.firstWarning }),
    };
}
/** Create a file watcher that appends new lines to the viewer. Caller must dispose when done. */
function createTailWatcher(uri, sessionMidnightMs, initialLineCount, target) {
    target.setTailLastLineCount(initialLineCount);
    const watcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
    watcher.onDidChange(async () => {
        if (target.getCurrentFileUri()?.fsPath !== uri.fsPath || !target.getView()) {
            return;
        }
        // Guard re-entrancy: rapid file changes can fire onDidChange again before we finish.
        if (target.getTailUpdateInProgress()) {
            return;
        }
        target.setTailUpdateInProgress(true);
        try {
            const raw = await vscode.workspace.fs.readFile(uri);
            const rawLines = Buffer.from(raw).toString("utf-8").split(/\r?\n/);
            const headerEnd = (0, viewer_file_loader_1.findHeaderEnd)(rawLines);
            const contentLines = rawLines.slice(headerEnd);
            const lastCount = target.getTailLastLineCount();
            if (contentLines.length <= lastCount) {
                return;
            }
            const newLines = contentLines.slice(lastCount);
            const ctx = { classifyFrame: (t) => helpers.classifyFrame(t), sessionMidnightMs };
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(newLines, ctx);
            target.setTailLastLineCount(contentLines.length);
            target.postMessage({ type: "addLines", lines: pending, lineCount: contentLines.length });
            helpers.sendNewCategories(pending, target.getSeenCategories(), (msg) => target.postMessage(msg));
        }
        catch {
            // File may be locked or deleted
        }
        finally {
            target.setTailUpdateInProgress(false);
        }
    });
    return watcher;
}
//# sourceMappingURL=log-viewer-provider-load.js.map