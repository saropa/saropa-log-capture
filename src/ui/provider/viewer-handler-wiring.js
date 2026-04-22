"use strict";
/**
 * Shared handler wiring for viewer targets.
 *
 * Wires the same webview → extension callbacks on both the sidebar
 * LogViewerProvider and the pop-out PopOutPanel, avoiding duplication
 * in extension.ts.
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
exports.SESSION_PANEL_ROOT_KEY = void 0;
exports.wireSharedHandlers = wireSharedHandlers;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const learning_runtime_1 = require("../../modules/learning/learning-runtime");
const config_1 = require("../../modules/config/config");
const log_search_ui_1 = require("../../modules/search/log-search-ui");
const log_search_1 = require("../../modules/search/log-search");
const analysis_panel_1 = require("../analysis/analysis-panel");
const filter_presets_1 = require("../../modules/storage/filter-presets");
const viewer_provider_helpers_1 = require("./viewer-provider-helpers");
const viewer_handler_bookmarks_1 = require("./viewer-handler-bookmarks");
const viewer_handler_sessions_1 = require("./viewer-handler-sessions");
/** Workspace state: Logs panel root folder override (URI string). */
exports.SESSION_PANEL_ROOT_KEY = "sessionPanelRootFolder";
/** Workspace state: last folder used in browse dialog so defaultUri is never system default. */
const SESSION_PANEL_LAST_BROWSE_KEY = "sessionPanelLastBrowseFolder";
/** Wire common webview→extension handlers on a viewer target. */
function wireSharedHandlers(target, deps) {
    const { sessionManager, broadcaster, historyProvider } = deps;
    // --- Marker, link click, pause ---
    target.setMarkerHandler(() => sessionManager.insertMarker());
    target.setLinkClickHandler((f, l, c, s) => (0, viewer_provider_helpers_1.openSourceFile)(f, l, c, s));
    target.setTogglePauseHandler(() => {
        const p = sessionManager.togglePause();
        if (p !== undefined) {
            broadcaster.setPaused(p);
        }
    });
    wireExclusionHandlers(target, broadcaster);
    wireContentHandlers(target, sessionManager, broadcaster, historyProvider);
    // --- Session list, browse/clear root, session actions ---
    wireSessionListHandlers(target, deps);
    (0, viewer_handler_bookmarks_1.wireBookmarkHandlers)(target, {
        sessionManager, broadcaster,
        bookmarkStore: deps.bookmarkStore,
        onOpenBookmark: deps.onOpenBookmark,
    });
}
function wireExclusionHandlers(target, broadcaster) {
    target.setExclusionAddedHandler(async (pattern) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const cur = cfg.get('exclusions', []);
        if (!cur.includes(pattern)) {
            await cfg.update('exclusions', [...cur, pattern], vscode.ConfigurationTarget.Workspace);
            // Learning: one event per newly added exclusion (avoids duplicate signals on replay).
            (0, learning_runtime_1.getInteractionTracker)()?.track({ type: 'add-exclusion', lineText: pattern, lineLevel: '' });
        }
    });
    target.setExclusionRemovedHandler(async (pattern) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const cur = cfg.get('exclusions', []);
        const updated = cur.filter(p => p !== pattern);
        if (updated.length !== cur.length) {
            await cfg.update('exclusions', updated, vscode.ConfigurationTarget.Workspace);
            broadcaster.setExclusions(updated);
        }
    });
}
function wireContentHandlers(target, sessionManager, broadcaster, historyProvider) {
    target.setAnnotationPromptHandler(async (lineIndex, current) => {
        const text = await vscode.window.showInputBox({
            prompt: (0, l10n_1.t)('prompt.annotateLine', String(lineIndex + 1)),
            value: current,
        });
        if (text === undefined) {
            return;
        }
        broadcaster.setAnnotation(lineIndex, text);
        const session = sessionManager.getActiveSession();
        if (session) {
            await historyProvider.getMetaStore().addAnnotation(session.fileUri, {
                lineIndex, text, timestamp: new Date().toISOString(),
            });
        }
    });
    target.setSavePresetRequestHandler(async (filters) => {
        const preset = await (0, filter_presets_1.promptSavePreset)(filters);
        if (preset) {
            broadcaster.setPresets((0, filter_presets_1.loadPresets)());
        }
    });
    target.setSearchCodebaseHandler(async (text) => {
        await vscode.commands.executeCommand('workbench.action.findInFiles', { query: text });
    });
    target.setSearchSessionsHandler(async (text) => {
        const m = await (0, log_search_ui_1.showSearchQuickPick)(text);
        if (m) {
            await (0, log_search_1.openLogAtLine)(m);
        }
    });
    target.setAnalyzeLineHandler(async (text, idx, uri) => { await (0, analysis_panel_1.showAnalysis)(text, idx, uri); });
    target.setAddToWatchHandler(async (text) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const cur = cfg.get('watchPatterns', []);
        if (cur.some(p => p.pattern === text)) {
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.alreadyInWatchList', text));
            return;
        }
        await cfg.update('watchPatterns', [...cur, { pattern: text }], vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.addedToWatchList', text));
    });
}
/** Resolve the log directory URI from override or workspace default. */
function getLogDir(context) {
    const overrideStr = context.workspaceState.get(exports.SESSION_PANEL_ROOT_KEY);
    if (overrideStr) {
        return vscode.Uri.parse(overrideStr);
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? (0, config_1.getLogDirectoryUri)(folder) : undefined;
}
/** Human-readable path for the current log directory (for UI labels). */
function getSessionRootPath(context) {
    return getLogDir(context)?.fsPath ?? "No workspace";
}
/** Build the options object used for session payload records. */
function makePayloadOptions(deps) {
    const lastViewedMap = deps.context.workspaceState.get(viewer_provider_helpers_1.LOG_LAST_VIEWED_KEY, {});
    return {
        getActiveLastWriteTime: () => deps.sessionManager.getActiveLastWriteTime?.(),
        getLastViewedAt: (uri) => lastViewedMap[uri],
    };
}
/** Wire session list, browse root, clear root, and session action handlers. */
function wireSessionListHandlers(target, deps) {
    const { historyProvider, broadcaster, sessionManager } = deps;
    /** Non-streaming full refresh (used by the polling interval). */
    const refreshSessionList = async () => {
        const overrideUriStr = deps.context.workspaceState.get(exports.SESSION_PANEL_ROOT_KEY);
        const overrideUri = overrideUriStr ? vscode.Uri.parse(overrideUriStr) : undefined;
        const items = overrideUri
            ? await historyProvider.getAllChildrenFromRoot(overrideUri)
            : await historyProvider.getAllChildren();
        const payload = await (0, viewer_provider_helpers_1.buildSessionListPayload)(items, historyProvider.getActiveUri(), makePayloadOptions(deps));
        const rootLabel = getSessionRootPath(deps.context);
        broadcaster.sendSessionList(payload, { label: rootLabel, path: rootLabel, isDefault: !overrideUri });
    };
    /** Send the final session list to the webview (always clears the shimmer). */
    const sendFinalList = (records) => {
        const rootLabel = getSessionRootPath(deps.context);
        const overrideUriStr = deps.context.workspaceState.get(exports.SESSION_PANEL_ROOT_KEY);
        broadcaster.sendSessionList(records, { label: rootLabel, path: rootLabel, isDefault: !overrideUriStr });
    };
    /** Streaming refresh: sends items to webview progressively as metadata loads. */
    const refreshSessionListStreaming = async () => {
        const overrideUriStr = deps.context.workspaceState.get(exports.SESSION_PANEL_ROOT_KEY);
        const overrideUri = overrideUriStr ? vscode.Uri.parse(overrideUriStr) : undefined;
        const activeStr = historyProvider.getActiveUri()?.toString();
        const opts = makePayloadOptions(deps);
        const allRecords = [];
        /* Serialize UI updates: 8 workers load files in parallel, but only one
         * posts to the webview at a time. Each post is followed by a macrotask
         * yield (setTimeout) so the webview can render before the next update.
         * Without serialization, all 8 workers finish near-simultaneously and
         * the webview receives a burst that renders as a single pop-in. */
        let sendChain = Promise.resolve();
        const onItemLoaded = async (item) => {
            try {
                const rec = await (0, viewer_provider_helpers_1.buildSessionItemRecord)(item, activeStr, opts);
                allRecords.push(rec);
                sendChain = sendChain.then(() => {
                    broadcaster.postToWebview({ type: 'sessionListBatch', items: [rec] });
                    return new Promise(r => setTimeout(r, 0));
                }).catch(() => { });
                await sendChain;
            }
            catch { /* non-critical — row keeps its shimmer */ }
        };
        const onFilesFound = (files, logDir) => {
            const previews = files.map(f => ({
                filename: f,
                uriString: vscode.Uri.joinPath(logDir, f).toString(),
            }));
            broadcaster.postToWebview({ type: 'sessionListPreview', previews });
        };
        const items = await historyProvider.getAllChildrenStreaming(onItemLoaded, overrideUri, onFilesFound);
        // When cache was hit, callbacks never fired — build payload from returned items.
        if (allRecords.length === 0 && items.length > 0) {
            const payload = await (0, viewer_provider_helpers_1.buildSessionListPayload)(items, historyProvider.getActiveUri(), opts);
            sendFinalList(payload);
            return;
        }
        sendFinalList(allRecords);
    };
    let firstLoadFired = false;
    const ref = {};
    target.setSessionListHandler(() => {
        broadcaster.sendSessionListLoading(getSessionRootPath(deps.context));
        void refreshSessionListStreaming().then(() => {
            if (!firstLoadFired && deps.onFirstSessionListReady) {
                firstLoadFired = true;
                const cached = historyProvider.getItemsCache();
                if (cached) {
                    deps.onFirstSessionListReady(cached);
                }
            }
        }).catch(() => sendFinalList([]));
        if (ref.interval) {
            clearInterval(ref.interval);
        }
        ref.interval = setInterval(() => {
            if (sessionManager.getActiveSession()) {
                void refreshSessionList();
            }
        }, 30000);
    });
    deps.context.subscriptions.push({
        dispose() {
            if (ref.interval) {
                clearInterval(ref.interval);
                ref.interval = undefined;
            }
        },
    });
    target.setBrowseSessionRootHandler?.(async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        const defaultLogUri = folder ? (0, config_1.getLogDirectoryUri)(folder) : undefined;
        const lastBrowse = deps.context.workspaceState.get(SESSION_PANEL_LAST_BROWSE_KEY);
        const defaultUri = lastBrowse ? vscode.Uri.parse(lastBrowse) : defaultLogUri;
        const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true, canSelectMany: false, defaultUri: defaultUri ?? undefined,
        });
        if (uris?.length) {
            await deps.context.workspaceState.update(exports.SESSION_PANEL_ROOT_KEY, uris[0].toString());
            await deps.context.workspaceState.update(SESSION_PANEL_LAST_BROWSE_KEY, uris[0].toString());
            await refreshSessionList();
        }
    });
    target.setClearSessionRootHandler?.(async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        const defaultLogUri = folder ? (0, config_1.getLogDirectoryUri)(folder) : undefined;
        await deps.context.workspaceState.update(exports.SESSION_PANEL_ROOT_KEY, undefined);
        if (defaultLogUri) {
            await deps.context.workspaceState.update(SESSION_PANEL_LAST_BROWSE_KEY, defaultLogUri.toString());
        }
        await refreshSessionList();
    });
    target.setSessionActionHandler((action, uriStrings, filenames) => {
        void (0, viewer_handler_sessions_1.handleSessionAction)(action, uriStrings, filenames, {
            historyProvider, refreshList: refreshSessionList, openSessionForReplay: deps.openSessionForReplay,
        });
    });
}
//# sourceMappingURL=viewer-handler-wiring.js.map