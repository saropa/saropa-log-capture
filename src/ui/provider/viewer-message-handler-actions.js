"use strict";
/**
 * Viewer message handlers for copy, settings, keybindings, search, edit, session, etc.
 * Extracted to keep viewer-message-handler.ts under the line limit.
 *
 * Structure: dispatchViewerActionMessage delegates to two switch-based handlers
 * (handleCopyAndSettingsActions, handleSessionAndUiActions) to keep per-function
 * cognitive complexity and case count within Sonar limits. Message string fields
 * are read via msgStr() to avoid object stringification ([object Object]). Async
 * side effects use .then(undefined, () => {}) instead of void for Sonar compliance.
 *
 * Clipboard: `copyToClipboard` uses clipTextFromMsg() so non-string webview payloads do not
 * become silent empty writes; empty text surfaces a warning; success/error use status bar / dialog.
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
exports.dispatchViewerActionMessage = dispatchViewerActionMessage;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const helpers = __importStar(require("./viewer-provider-helpers"));
const bug_report_panel_1 = require("../panels/bug-report-panel");
const viewer_message_handler_panels_1 = require("./viewer-message-handler-panels");
const report_file_writer_1 = require("../../modules/bug-report/report-file-writer");
const extension_logger_1 = require("../../modules/misc/extension-logger");
const ai_context_builder_1 = require("../../modules/ai/ai-context-builder");
const ai_explain_1 = require("../../modules/ai/ai-explain");
const ai_explain_panel_1 = require("../panels/ai-explain-panel");
const viewer_keybindings_1 = require("../viewer/viewer-keybindings");
const learning_runtime_1 = require("../../modules/learning/learning-runtime");
const viewer_message_handler_root_cause_ai_1 = require("./viewer-message-handler-root-cause-ai");
const viewer_message_handler_static_sql_1 = require("./viewer-message-handler-static-sql");
const ai_enable_scope_1 = require("../../modules/ai/ai-enable-scope");
const ai_explain_ui_1 = require("../../modules/ai/ai-explain-ui");
const viewer_workspace_bool_message_map_1 = require("./viewer-workspace-bool-message-map");
const SAROPA_BOOL_SETTING_BY_MSG_TYPE = viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE;
exports.SAROPA_BOOL_SETTING_BY_MSG_TYPE = SAROPA_BOOL_SETTING_BY_MSG_TYPE;
function isAllowedExternalUrl(url) {
    const trimmed = url.trim();
    if (trimmed.length === 0 || trimmed.length > 2048) {
        return false;
    }
    return /^https?:\/\//i.test(trimmed) || /^vscode:\/\//i.test(trimmed);
}
/** Coerce message field to string; never stringify objects (avoids '[object Object]'). */
function msgStr(m, key, fallback = "") {
    const v = m[key];
    return typeof v === "string" ? v : fallback;
}
/** Clipboard payload from webview: accept only primitives as text (structured clone edge cases). */
function clipTextFromMsg(m) {
    const v = m.text;
    if (typeof v === "string") {
        return v;
    }
    if (v == null) {
        return "";
    }
    if (typeof v === "number" || typeof v === "boolean") {
        return String(v);
    }
    return "";
}
function applyAddAutoHidePattern(msg) {
    const pattern = msgStr(msg, "pattern").trim();
    if (!pattern) {
        return;
    }
    const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
    const current = cfg.get("autoHidePatterns") ?? [];
    if (!current.some(p => p.toLowerCase() === pattern.toLowerCase())) {
        cfg.update("autoHidePatterns", [...current, pattern], vscode.ConfigurationTarget.Workspace).then(undefined, () => { });
    }
}
function applyRemoveAutoHidePattern(msg) {
    const pattern = msgStr(msg, "pattern").trim();
    if (!pattern) {
        return;
    }
    const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
    const current = cfg.get("autoHidePatterns") ?? [];
    const lower = pattern.toLowerCase();
    const updated = current.filter(p => p.toLowerCase() !== lower);
    if (updated.length !== current.length) {
        cfg.update("autoHidePatterns", updated, vscode.ConfigurationTarget.Workspace).then(undefined, () => { });
    }
}
function runCopyWithSource(msg) {
    const text = clipTextFromMsg(msg).trim();
    const rawRefs = msg.sourceRefs;
    const sourceRefs = Array.isArray(rawRefs)
        ? rawRefs.map((r) => {
            const o = r;
            return { path: msgStr(o, "path"), line: Number(o.line) || 1 };
        }).filter((r) => r.path.length > 0)
        : [];
    helpers.buildCopyWithSource(text, sourceRefs)
        .then((out) => { vscode.env.clipboard.writeText(out).then(undefined, () => { }); })
        .catch(() => { vscode.env.clipboard.writeText(text || "").then(undefined, () => { }); });
}
function runExplainWithAi(msg, ctx) {
    const uri = ctx.currentFileUri;
    const text = msgStr(msg, "text").trim();
    const lineIdx = (0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0);
    if (!uri || !text) {
        return;
    }
    const aiCfg = vscode.workspace.getConfiguration("saropaLogCapture.ai");
    if (!aiCfg.get("enabled", false)) {
        const enableLabel = (0, l10n_1.t)("action.enable");
        vscode.window.showInformationMessage((0, l10n_1.t)("msg.aiExplainDisabled"), enableLabel).then(async (choice) => {
            if (choice === enableLabel) {
                await aiCfg.update("enabled", true, (0, ai_enable_scope_1.getAiEnabledConfigurationTarget)());
                runExplainWithAi(msg, ctx);
            }
        }, () => { });
        return;
    }
    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)("msg.aiExplainProgress"), cancellable: false }, async () => {
        let builtContext;
        try {
            const contextLines = Math.max(0, Math.min(50, aiCfg.get("contextLines", 10)));
            const lineTimestampMs = typeof msg.timestamp === "number" ? msg.timestamp : undefined;
            const includeIntegrationData = aiCfg.get("includeIntegrationData", true);
            const cacheExplanations = aiCfg.get("cacheExplanations", true);
            const lineEndIndex = typeof msg.lineEndIndex === "number" && msg.lineEndIndex >= lineIdx ? msg.lineEndIndex : undefined;
            builtContext = await (0, ai_context_builder_1.buildAIContext)(uri, lineIdx, text, { contextLines, lineTimestampMs, includeIntegrationData, lineEndIndex });
            const result = await (0, ai_explain_1.explainError)(builtContext, { useCache: cacheExplanations });
            const explanation = result.explanation;
            const suffix = result.cached ? (0, l10n_1.t)("panel.aiExplainCached") : "";
            const toShow = (explanation.length > 500 ? explanation.slice(0, 497) + "…" : explanation) + suffix;
            const choice = await vscode.window.showInformationMessage(toShow, "Copy", "Show details");
            if (choice === "Copy") {
                vscode.env.clipboard.writeText(explanation).then(undefined, () => { });
            }
            if (choice === "Show details") {
                (0, ai_explain_panel_1.showAIExplanationPanel)(builtContext, result);
            }
        }
        catch (err) {
            if (builtContext) {
                await (0, ai_explain_ui_1.showAiExplainRunFailure)(builtContext, err);
            }
            else {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage((0, l10n_1.t)("msg.aiExplainError", message)).then(undefined, () => { });
            }
        }
    });
}
function runCreateReportFile(msg, ctx) {
    if (!ctx.currentFileUri) {
        return;
    }
    (0, report_file_writer_1.createBugReportFile)({
        selectedText: msgStr(msg, "selectedText"),
        selectedLineStart: (0, viewer_message_handler_panels_1.safeLineIndex)(msg.selectedLineStart, 0),
        selectedLineEnd: (0, viewer_message_handler_panels_1.safeLineIndex)(msg.selectedLineEnd, 0),
        sessionInfo: msg.sessionInfo ?? {},
        fullDecoratedOutput: msgStr(msg, "fullDecoratedOutput"),
        fullOutputLineCount: typeof msg.fullOutputLineCount === "number" ? msg.fullOutputLineCount : 0,
        fileUri: ctx.currentFileUri,
        errorText: msgStr(msg, "text"),
        lineIndex: (0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0),
        extensionContext: ctx.context,
    }).catch(() => { });
}
function handleCopyAndSettingsActions(type, msg, ctx) {
    switch (type) {
        case "insertMarker":
            ctx.onMarkerRequest?.();
            return true;
        case "togglePause":
            ctx.onTogglePause?.();
            return true;
        case "copyToClipboard": {
            const text = clipTextFromMsg(msg);
            if (text.length === 0) {
                vscode.window.showWarningMessage((0, l10n_1.t)("msg.logCopyEmpty")).then(undefined, () => { });
                return true;
            }
            void vscode.env.clipboard.writeText(text).then(() => { vscode.window.setStatusBarMessage((0, l10n_1.t)("msg.logCopyStatus", text.length), 2500); }, (err) => {
                const detail = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage((0, l10n_1.t)("msg.logCopyFailed", detail)).then(undefined, () => { });
            });
            return true;
        }
        case "copyWithSource":
            runCopyWithSource(msg);
            return true;
        case "presetApplied":
            if (msg.name) {
                ctx.context.workspaceState.update("saropaLogCapture.lastUsedPresetName", msgStr(msg, "name")).then(undefined, () => { });
            }
            return true;
        case "copySourcePath":
            helpers.copySourcePath(msgStr(msg, "path"), msgStr(msg, "mode", "relative"));
            return true;
        case "exclusionAdded":
        case "addToExclusion": {
            const pat = msgStr(msg, "pattern") || msgStr(msg, "text");
            ctx.onExclusionAdded?.(pat);
            return true;
        }
        case "exclusionRemoved":
            ctx.onExclusionRemoved?.(msgStr(msg, "pattern"));
            return true;
        case "addAutoHidePattern":
            applyAddAutoHidePattern(msg);
            return true;
        case "removeAutoHidePattern":
            applyRemoveAutoHidePattern(msg);
            return true;
        case "openSettings":
            vscode.commands.executeCommand("workbench.action.openSettings", msgStr(msg, "setting")).then(undefined, () => { });
            return true;
        case "openKeybindings":
            vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", msgStr(msg, "search", "Saropa Log Capture")).then(undefined, () => { });
            return true;
        case "startRecordViewerKey": {
            const actionId = msgStr(msg, "actionId");
            ctx.post({ type: 'viewerKeybindingRecordMode', active: true, actionId });
            const label = (0, viewer_keybindings_1.getViewerActionLabel)(actionId);
            vscode.window.setStatusBarMessage(`Saropa: Press a key for ${label} (Escape to cancel)`, 5000);
            return true;
        }
        case "viewerKeybindingRecordCancelled":
            ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
            return true;
        case "viewerKeybindingRecorded": {
            const actionId = msgStr(msg, "actionId");
            const key = msgStr(msg, "key").trim();
            if (actionId && key) {
                (0, viewer_keybindings_1.setViewerKeybinding)(actionId, key).then(() => {
                    const keyToAction = (0, viewer_keybindings_1.getViewerKeybindingsFromConfig)();
                    ctx.post({ type: 'setViewerKeybindings', keyToAction });
                    ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
                }).catch(() => {
                    ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
                });
            }
            else {
                ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
            }
            return true;
        }
        case "searchCodebase":
            ctx.onSearchCodebase?.(msgStr(msg, "text"));
            return true;
        case "searchSessions":
            ctx.onSearchSessions?.(msgStr(msg, "text"));
            return true;
        case "analyzeLine":
            ctx.onAnalyzeLine?.(msgStr(msg, "text"), (0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, -1), ctx.currentFileUri);
            return true;
        case "generateReport":
            if (ctx.currentFileUri) {
                (0, bug_report_panel_1.showBugReport)(msgStr(msg, "text"), (0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0), ctx.currentFileUri, ctx.context).catch(() => { });
            }
            return true;
        case "createReportFile":
            runCreateReportFile(msg, ctx);
            return true;
        case "explainWithAi":
            runExplainWithAi(msg, ctx);
            return true;
        case "explainRootCauseHypotheses":
            (0, viewer_message_handler_root_cause_ai_1.runExplainRootCauseHypotheses)(msg, ctx);
            return true;
        case "explainRootCauseHypothesesEmpty":
            vscode.window.showInformationMessage((0, l10n_1.t)("msg.explainRootCauseHypothesesEmpty")).then(undefined, () => { });
            return true;
        case "findStaticSourcesForSqlFingerprint":
            void (0, viewer_message_handler_static_sql_1.runFindStaticSourcesForSqlFingerprint)(msgStr(msg, "fingerprint"));
            return true;
        default:
            return false;
    }
}
function runOpenUrl(msg) {
    const url = msgStr(msg, "url");
    if (isAllowedExternalUrl(url)) {
        vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => { });
    }
    else {
        (0, extension_logger_1.logExtensionWarn)('viewerMessage', 'openUrl rejected: invalid or disallowed scheme');
    }
}
function runSessionAction(msg, ctx) {
    const uriStrings = Array.isArray(msg.uriStrings) ? msg.uriStrings : [msgStr(msg, "uriString")];
    const filenames = Array.isArray(msg.filenames) ? msg.filenames : [msgStr(msg, "filename")];
    ctx.onSessionAction?.(msgStr(msg, "action"), uriStrings, filenames);
}
function handleSessionAndUiActions(type, msg, ctx) {
    const boolKey = SAROPA_BOOL_SETTING_BY_MSG_TYPE[type];
    if (boolKey) {
        vscode.workspace.getConfiguration("saropaLogCapture")
            .update(boolKey, Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
        return true;
    }
    switch (type) {
        case "addToWatch":
            ctx.onAddToWatch?.(msgStr(msg, "text"));
            return true;
        case "promptAnnotation":
            ctx.onAnnotationPrompt?.((0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0), msgStr(msg, "current"));
            return true;
        case "addBookmark": {
            const bm = msgStr(msg, "text").trim();
            if (bm) {
                (0, learning_runtime_1.getInteractionTracker)()?.track({ type: "explicit-keep", lineText: bm, lineLevel: "" });
            }
            ctx.onAddBookmark?.((0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0), msgStr(msg, "text"), ctx.currentFileUri);
            return true;
        }
        case "linkClicked":
            ctx.onLinkClick?.(msgStr(msg, "path"), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
            return true;
        case "openUrl":
            runOpenUrl(msg);
            return true;
        case "navigatePart":
            ctx.onPartNavigate?.(Math.max(1, (0, viewer_message_handler_panels_1.safeLineIndex)(msg.part, 1)));
            return true;
        case "navigateSession": {
            const d = Number(msg.direction);
            ctx.onSessionNavigate?.(d < 0 ? -1 : 1);
            return true;
        }
        case "savePresetRequest":
            ctx.onSavePresetRequest?.(msg.filters ?? {});
            return true;
        case "setCaptureAll":
            vscode.workspace.getConfiguration("saropaLogCapture")
                .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
            return true;
        case "setMinimapWidth": {
            const w = msgStr(msg, "value");
            const allowed = new Set(["xsmall", "small", "medium", "large", "xlarge"]);
            if (!allowed.has(w))
                return true;
            vscode.workspace.getConfiguration("saropaLogCapture")
                .update("minimapWidth", w, vscode.ConfigurationTarget.Workspace);
            return true;
        }
        case "editLine":
            helpers.handleEditLine(ctx.currentFileUri, ctx.isSessionActive, {
                lineIndex: (0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0), newText: msgStr(msg, "newText"),
                timestamp: Number(msg.timestamp ?? 0), loadFromFile: ctx.load,
            }).catch((err) => { vscode.window.showErrorMessage((0, l10n_1.t)('msg.failedEditLine', err.message)); });
            return true;
        case "exportLogs":
            helpers.handleExportLogs(msgStr(msg, "text"), msg.options ?? {})
                .catch((err) => { vscode.window.showErrorMessage((0, l10n_1.t)('msg.failedExportLogs', err.message)); });
            return true;
        case "saveLevelFilters":
            helpers.saveLevelFilters(ctx.context, msgStr(msg, "filename"), msg.levels ?? []);
            return true;
        case "requestFindInFiles":
            ctx.onFindInFiles?.(msgStr(msg, "query"), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
            return true;
        case "openFindResult":
            ctx.onOpenFindResult?.(msgStr(msg, "uriString"), msgStr(msg, "query"), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
            return true;
        case "findNavigateMatch":
            ctx.onFindNavigateMatch?.(msgStr(msg, "uriString"), (0, viewer_message_handler_panels_1.safeLineIndex)(msg.matchIndex, 0));
            return true;
        case "requestBookmarks":
        case "deleteBookmark":
        case "deleteFileBookmarks":
        case "deleteAllBookmarks":
        case "editBookmarkNote":
        case "openBookmark":
            ctx.onBookmarkAction?.(msg);
            return true;
        case "requestSessionList":
            ctx.onSessionListRequest?.();
            return true;
        case "runCommand":
            vscode.commands.executeCommand(msgStr(msg, "command"), ...(Array.isArray(msg.args) ? msg.args : [])).then(undefined, () => { });
            return true;
        case "browseSessionRoot":
            ctx.onBrowseSessionRoot?.()?.then(undefined, () => { });
            return true;
        case "clearSessionRoot":
            ctx.onClearSessionRoot?.()?.then(undefined, () => { });
            return true;
        case "openSessionFromPanel":
            ctx.onOpenSessionFromPanel?.(msgStr(msg, "uriString"));
            return true;
        case "sessionAction":
            runSessionAction(msg, ctx);
            return true;
        case "popOutViewer":
            ctx.onPopOutRequest?.();
            return true;
        case "openInsightTab":
            ctx.onOpenInsightTabRequest?.();
            return true;
        case "revealLogFile":
            if (ctx.currentFileUri && ctx.onRevealLogFile) {
                Promise.resolve(ctx.onRevealLogFile(ctx.currentFileUri.toString())).catch(() => { });
            }
            return true;
        // Hold-to-copy path: show status bar confirmation so users get visible feedback.
        case "copyCurrentFilePath":
            if (ctx.currentFileUri) {
                vscode.env.clipboard.writeText(ctx.currentFileUri.fsPath).then(() => { vscode.window.setStatusBarMessage((0, l10n_1.t)('msg.filePathCopied'), 2000); }, () => { });
            }
            return true;
        // Reveal current file in OS so the containing folder opens (not the parent folder).
        case "openCurrentFileFolder":
            if (ctx.currentFileUri) {
                vscode.commands.executeCommand('revealFileInOS', ctx.currentFileUri).then(() => { }, () => { });
            }
            return true;
        case "openSidecarFile": {
            const sidecar = msgStr(msg, "filename");
            if (sidecar && ctx.currentFileUri && !sidecar.includes('/') && !sidecar.includes('\\')) {
                vscode.window.showTextDocument(vscode.Uri.joinPath(ctx.currentFileUri, '..', sidecar), { preview: true, viewColumn: vscode.ViewColumn.Beside }).then(undefined, () => { });
            }
            return true;
        }
        case "setSessionDisplayOptions":
            ctx.onDisplayOptionsChange?.(msg.options);
            return true;
        case "promptGoToLine":
            vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('prompt.goToLine'),
                validateInput: (v) => /^\d+$/.test(v) ? null : (0, l10n_1.t)('prompt.goToLineValidate'),
            })
                .then((v) => { if (v) {
                ctx.post({ type: "scrollToLine", line: Number.parseInt(v, 10) });
            } });
            return true;
        default:
            return false;
    }
}
/**
 * Handle action messages (copy, settings, keybindings, search, edit, session, etc.).
 * Returns true if the message was handled.
 */
function dispatchViewerActionMessage(msg, ctx) {
    const type = msg.type;
    if (handleCopyAndSettingsActions(type, msg, ctx)) {
        return true;
    }
    if (handleSessionAndUiActions(type, msg, ctx)) {
        return true;
    }
    return false;
}
//# sourceMappingURL=viewer-message-handler-actions.js.map