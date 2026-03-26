"use strict";
/**
 * Helper functions for LogViewerProvider — message handlers and batch processing.
 *
 * Handles edit-line, export-logs, copy, and tree→webview payload building. Also provides
 * line batching, category tracking, and cached config (presets/highlight rules) posting.
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
exports.MAX_LINES_PER_BATCH = exports.updateLastViewed = exports.LOG_LAST_VIEWED_KEY = exports.buildCopyWithSource = exports.copySourcePath = exports.openSourceFile = exports.buildSessionListPayload = void 0;
exports.handleEditLine = handleEditLine;
exports.handleExportLogs = handleExportLogs;
exports.flushBatch = flushBatch;
exports.sendNewCategories = sendNewCategories;
exports.classifyFrame = classifyFrame;
exports.lookupQuality = lookupQuality;
exports.tryFormatThreadHeader = tryFormatThreadHeader;
exports.sendCachedConfig = sendCachedConfig;
exports.updateBadge = updateBadge;
exports.startBatchTimer = startBatchTimer;
exports.stopBatchTimer = stopBatchTimer;
exports.saveLevelFilters = saveLevelFilters;
exports.getSavedLevelFilters = getSavedLevelFilters;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const viewer_file_loader_1 = require("../viewer/viewer-file-loader");
const stack_parser_1 = require("../../modules/analysis/stack-parser");
const ansi_1 = require("../../modules/capture/ansi");
const source_linker_1 = require("../../modules/source/source-linker");
const code_coverage_1 = require("../../modules/integrations/providers/code-coverage");
const coverage_per_file_1 = require("../../modules/integrations/providers/coverage-per-file");
const extension_logger_1 = require("../../modules/misc/extension-logger");
var viewer_provider_actions_1 = require("./viewer-provider-actions");
Object.defineProperty(exports, "buildSessionListPayload", { enumerable: true, get: function () { return viewer_provider_actions_1.buildSessionListPayload; } });
Object.defineProperty(exports, "openSourceFile", { enumerable: true, get: function () { return viewer_provider_actions_1.openSourceFile; } });
Object.defineProperty(exports, "copySourcePath", { enumerable: true, get: function () { return viewer_provider_actions_1.copySourcePath; } });
Object.defineProperty(exports, "buildCopyWithSource", { enumerable: true, get: function () { return viewer_provider_actions_1.buildCopyWithSource; } });
Object.defineProperty(exports, "LOG_LAST_VIEWED_KEY", { enumerable: true, get: function () { return viewer_provider_actions_1.LOG_LAST_VIEWED_KEY; } });
Object.defineProperty(exports, "updateLastViewed", { enumerable: true, get: function () { return viewer_provider_actions_1.updateLastViewed; } });
/** Handle editing a log line in the current file. */
async function handleEditLine(currentFileUri, isSessionActive, input) {
    if (!currentFileUri) {
        vscode.window.showWarningMessage((0, l10n_1.t)('msg.noLogFileLoaded'));
        return;
    }
    if (isSessionActive) {
        const choice = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.debugSessionActiveEdit'), { modal: true }, (0, l10n_1.t)('action.editAnyway'), (0, l10n_1.t)('action.cancel'));
        if (choice !== (0, l10n_1.t)('action.editAnyway')) {
            return;
        }
    }
    try {
        const raw = await vscode.workspace.fs.readFile(currentFileUri);
        const text = Buffer.from(raw).toString("utf-8");
        const lines = text.split(/\r?\n/);
        const dataStartIndex = (0, viewer_file_loader_1.findHeaderEnd)(lines);
        const targetIndex = dataStartIndex + input.lineIndex;
        if (targetIndex < dataStartIndex || targetIndex >= lines.length) {
            vscode.window.showErrorMessage((0, l10n_1.t)('msg.lineIndexOutOfRange', String(input.lineIndex)));
            return;
        }
        lines[targetIndex] = input.newText;
        const newContent = lines.join('\n');
        await vscode.workspace.fs.writeFile(currentFileUri, Buffer.from(newContent, 'utf-8'));
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.lineUpdatedSuccess', String(input.lineIndex + 1)));
        await input.loadFromFile(currentFileUri);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        (0, extension_logger_1.logExtensionError)('editLine', err instanceof Error ? err : new Error(message));
        throw new Error(`File edit failed: ${message}`);
    }
}
/**
 * Handle exporting logs to a file.
 */
async function handleExportLogs(text, options) {
    // Prompt user to choose save location (workspace-based default for remote/SSH/WSL/Dev Containers)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const defaultUri = workspaceFolder
        ? vscode.Uri.joinPath(workspaceFolder.uri, 'exported-logs.txt')
        : vscode.Uri.file('exported-logs.txt');
    const uri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
            [(0, l10n_1.t)('filter.textFiles')]: ['txt', 'log'],
            [(0, l10n_1.t)('filter.allFiles')]: ['*'],
        },
        saveLabel: (0, l10n_1.t)('saveLabel.exportLogs'),
    });
    if (!uri) {
        return; // User cancelled
    }
    try {
        // Write the exported content to the selected file
        await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'));
        const lineCount = options.lineCount ?? 0;
        const levels = options.levels ?? [];
        const levelStr = levels.length > 0 ? ` (${levels.join(', ')})` : '';
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.exportedLinesTo', String(lineCount), lineCount === 1 ? '' : 's', levelStr, uri.fsPath));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        (0, extension_logger_1.logExtensionError)('exportLogs', err instanceof Error ? err : new Error(message));
        throw new Error(`Export failed: ${message}`);
    }
}
/** Max lines sent per addLines message to avoid webview CPU spike under heavy load. */
exports.MAX_LINES_PER_BATCH = 2000;
/**
 * Flush batched lines to the webview. Sends at most MAX_LINES_PER_BATCH per call.
 */
function flushBatch(pendingLines, isReady, postMessage, sendNewCategories) {
    if (pendingLines.length === 0 || !isReady) {
        return;
    }
    const take = Math.min(pendingLines.length, exports.MAX_LINES_PER_BATCH);
    const lines = pendingLines.splice(0, take);
    postMessage({ type: "addLines", lines, lineCount: lines[lines.length - 1].lineCount });
    sendNewCategories(lines);
}
/**
 * Send new categories to the webview.
 */
function sendNewCategories(lines, seenCategories, postMessage) {
    const newCats = [];
    for (const ln of lines) {
        if (!ln.isMarker && !seenCategories.has(ln.category)) {
            seenCategories.add(ln.category);
            newCats.push(ln.category);
        }
    }
    if (newCats.length > 0) {
        postMessage({ type: "setCategories", categories: newCats });
    }
}
/**
 * Classify a log line as framework or app code.
 * Handles both stack frames ("    at ...") and regular output
 * (e.g. Android logcat "D/TAG(PID): msg", launch boilerplate).
 */
function classifyFrame(text) {
    if (/^\s+at\s/.test(text)) {
        return (0, stack_parser_1.isFrameworkFrame)(text, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    }
    return (0, stack_parser_1.isFrameworkLogLine)(text);
}
/**
 * Look up per-file coverage for an app-code stack frame line.
 * Returns coverage percent (0–100) or undefined if not applicable.
 */
function lookupQuality(text, fw) {
    if (fw !== false) {
        return undefined;
    }
    if (!(0, stack_parser_1.isStackFrameLine)(text)) {
        return undefined;
    }
    const map = (0, code_coverage_1.getPerFileCoverageMap)();
    if (!map) {
        return undefined;
    }
    const ref = (0, source_linker_1.extractSourceReference)(text);
    if (!ref) {
        return undefined;
    }
    return (0, coverage_per_file_1.lookupCoverage)(map, ref.filePath);
}
/** If the raw text is a thread header, return styled HTML; otherwise return the original html. */
function tryFormatThreadHeader(rawText, html) {
    const parsed = (0, stack_parser_1.parseThreadHeader)((0, ansi_1.stripAnsi)(rawText));
    if (!parsed) {
        return html;
    }
    const tid = parsed.tid !== undefined ? ` (tid=${parsed.tid})` : '';
    const state = parsed.state ? ` \u2014 ${escapeForAttr(parsed.state)}` : '';
    return `<span class="thread-header">${escapeForAttr(parsed.name)}${tid}${state}</span>`;
}
function escapeForAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/**
 * Send cached configuration (presets and highlight rules) to the webview.
 * Optionally include lastUsedPresetName so the webview can re-apply it on load.
 */
function sendCachedConfig(cachedPresets, cachedHighlightRules, postMessage, lastUsedPresetName) {
    if (cachedPresets.length > 0) {
        postMessage({ type: "setPresets", presets: cachedPresets, lastUsedPresetName: lastUsedPresetName ?? undefined });
    }
    if (cachedHighlightRules.length > 0) {
        postMessage({ type: "setHighlightRules", rules: cachedHighlightRules });
    }
}
/**
 * Update the view badge with watch hit count.
 */
function updateBadge(view, unreadWatchHits) {
    if (!view) {
        return;
    }
    view.badge = unreadWatchHits > 0
        ? { value: unreadWatchHits, tooltip: `${unreadWatchHits} watch hits` }
        : undefined;
}
/**
 * Start the batch timer for flushing pending lines.
 */
function startBatchTimer(batchIntervalMs, flushBatch, stopBatchTimer) {
    stopBatchTimer();
    return setInterval(flushBatch, batchIntervalMs);
}
/**
 * Stop the batch timer.
 */
function stopBatchTimer(timer) {
    if (timer !== undefined) {
        clearInterval(timer);
    }
}
const LEVEL_FILTERS_KEY = "slc.levelFilters";
/** Save per-file level filter state to workspace storage. */
function saveLevelFilters(context, filename, levels) {
    if (!filename) {
        return;
    }
    const map = context.workspaceState.get(LEVEL_FILTERS_KEY, {});
    map[filename] = levels;
    void context.workspaceState.update(LEVEL_FILTERS_KEY, map);
}
/** Retrieve saved level filter state for a file, or undefined if none. */
function getSavedLevelFilters(context, filename) {
    if (!filename) {
        return undefined;
    }
    const map = context.workspaceState.get(LEVEL_FILTERS_KEY, {});
    return map[filename];
}
//# sourceMappingURL=viewer-provider-helpers.js.map