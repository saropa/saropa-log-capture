"use strict";
/**
 * Extension activation logic — provider registration, handlers, config, lifecycle.
 * Extracted from extension.ts to keep the entry point under the line limit.
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
exports.runActivation = runActivation;
const vscode = __importStar(require("vscode"));
const config_1 = require("./modules/config/config");
const tracker_1 = require("./modules/capture/tracker");
const session_manager_1 = require("./modules/session/session-manager");
const status_bar_1 = require("./ui/shared/status-bar");
const capture_toggle_status_bar_1 = require("./ui/shared/capture-toggle-status-bar");
const session_history_provider_1 = require("./ui/session/session-history-provider");
const deep_links_1 = require("./modules/features/deep-links");
const gist_importer_1 = require("./modules/share/gist-importer");
const github_auth_1 = require("./modules/share/github-auth");
const activation_broadcaster_config_1 = require("./activation-broadcaster-config");
const commands_1 = require("./commands");
const session_display_1 = require("./ui/session/session-display");
const viewer_broadcaster_1 = require("./ui/provider/viewer-broadcaster");
const pop_out_panel_1 = require("./ui/viewer-panels/pop-out-panel");
const extension_activation_handlers_1 = require("./extension-activation-handlers");
const viewer_handler_wiring_1 = require("./ui/provider/viewer-handler-wiring");
const gitignore_checker_1 = require("./modules/config/gitignore-checker");
const crashlytics_io_1 = require("./modules/crashlytics/crashlytics-io");
const session_metadata_1 = require("./modules/session/session-metadata");
const project_indexer_1 = require("./modules/project-indexer/project-indexer");
const bookmark_store_1 = require("./modules/storage/bookmark-store");
const viewer_provider_helpers_1 = require("./ui/provider/viewer-provider-helpers");
const extension_lifecycle_1 = require("./extension-lifecycle");
const session_group_tracker_1 = require("./modules/session/session-group-tracker");
const file_retention_1 = require("./modules/config/file-retention");
const ai_watcher_1 = require("./modules/ai/ai-watcher");
const ai_line_formatter_1 = require("./modules/ai/ai-line-formatter");
const activation_integrations_1 = require("./activation-integrations");
const api_1 = require("./api");
const collection_store_1 = require("./modules/collection/collection-store");
const collection_panel_1 = require("./ui/collection/collection-panel");
const activation_providers_1 = require("./activation-providers");
const activation_listeners_1 = require("./activation-listeners");
const diagnostic_cache_1 = require("./modules/diagnostics/diagnostic-cache");
const extension_activation_helpers_1 = require("./extension-activation-helpers");
const learning_runtime_1 = require("./modules/learning/learning-runtime");
const learning_notifications_1 = require("./modules/learning/learning-notifications");
const ai_auto_enable_1 = require("./modules/ai/ai-auto-enable");
const flutter_crash_watcher_1 = require("./modules/integrations/flutter-crash-watcher");
function runActivation(context, outputChannel) {
    const statusBar = new status_bar_1.StatusBar();
    const captureToggle = new capture_toggle_status_bar_1.CaptureToggleStatusBar((0, config_1.getConfig)().enabled);
    context.subscriptions.push(statusBar, captureToggle, outputChannel);
    const sessionManager = new session_manager_1.SessionManagerImpl(statusBar, outputChannel);
    (0, learning_runtime_1.initLearningRuntime)(context, sessionManager);
    context.subscriptions.push({ dispose: () => { void (0, learning_runtime_1.flushLearningBuffer)(); } });
    const apiHandle = (0, api_1.createApi)(sessionManager);
    const folder = vscode.workspace.workspaceFolders?.[0];
    let projectIndexer = null;
    if (folder && (0, config_1.getConfig)().projectIndex.enabled) {
        projectIndexer = new project_indexer_1.ProjectIndexer(folder);
        (0, project_indexer_1.setGlobalProjectIndexer)(projectIndexer);
        sessionManager.setProjectIndexer(projectIndexer);
        projectIndexer.startWatching();
        context.subscriptions.push({ dispose: () => { projectIndexer?.dispose(); projectIndexer = null; (0, project_indexer_1.setGlobalProjectIndexer)(null); } });
    }
    (0, activation_integrations_1.registerAllIntegrations)();
    // Watch workspace root for Flutter CLI crash logs (flutter_*.log) and import to reports.
    if (folder && ((0, config_1.getConfig)().integrationsAdapters ?? []).includes('flutterCrashLogs')) {
        context.subscriptions.push((0, flutter_crash_watcher_1.startFlutterCrashWatcher)(folder, outputChannel));
    }
    const version = String(context.extension.packageJSON.version ?? '');
    const { viewerProvider, inlineDecorations } = (0, activation_providers_1.setupWebviewProviders)(context, version);
    const broadcaster = new viewer_broadcaster_1.ViewerBroadcaster();
    const diagnosticCache = new diagnostic_cache_1.DiagnosticCache();
    diagnosticCache.activate(context.subscriptions);
    broadcaster.setDiagnosticCache(diagnosticCache);
    const popOutPanel = new pop_out_panel_1.PopOutPanel({
        extensionUri: context.extensionUri,
        version,
        context,
        broadcaster,
        getHydrationUri: () => viewerProvider.getCurrentFileUri(),
    });
    broadcaster.addTarget(viewerProvider);
    broadcaster.addTarget(popOutPanel);
    context.subscriptions.push(popOutPanel);
    const historyProvider = new session_history_provider_1.SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    historyProvider.onDidChangeTreeData(async () => {
        const overrideUriStr = context.workspaceState.get(viewer_handler_wiring_1.SESSION_PANEL_ROOT_KEY);
        if (overrideUriStr) {
            return;
        }
        const defaultLabel = folder ? (0, config_1.getLogDirectoryUri)(folder).fsPath : 'No workspace';
        broadcaster.sendSessionListLoading(defaultLabel);
        const items = await historyProvider.getAllChildren();
        const lastViewedMap = context.workspaceState.get(viewer_provider_helpers_1.LOG_LAST_VIEWED_KEY, {});
        const payload = await (0, viewer_provider_helpers_1.buildSessionListPayload)(items, historyProvider.getActiveUri(), {
            getActiveLastWriteTime: () => sessionManager.getActiveLastWriteTime?.(),
            getLastViewedAt: (uri) => lastViewedMap[uri],
        });
        broadcaster.sendSessionList(payload, { label: defaultLabel, path: defaultLabel, isDefault: true });
    });
    const bookmarkStore = new bookmark_store_1.BookmarkStore(context);
    context.subscriptions.push(bookmarkStore);
    bookmarkStore.onDidChange(() => { broadcaster.sendBookmarkList(bookmarkStore.getAll()); });
    const collectionStore = new collection_store_1.CollectionStore(context);
    context.subscriptions.push(collectionStore, { dispose: collection_panel_1.disposeCollectionPanel });
    const importHandlers = {
        importFromGist: (gistId) => (0, gist_importer_1.importFromGist)(gistId, collectionStore),
        importFromUrl: (url) => (0, gist_importer_1.importFromUrl)(url, collectionStore),
    };
    context.subscriptions.push(vscode.window.registerUriHandler((0, deep_links_1.createUriHandler)(importHandlers)), vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id !== 'github') {
            return;
        }
        const session = await vscode.authentication.getSession('github', [], { createIfNone: false });
        if (!session) {
            await (0, github_auth_1.clearGitHubToken)(context);
        }
    }));
    const initCfg = (0, config_1.getConfig)();
    (0, activation_broadcaster_config_1.applyInitialBroadcasterConfig)(broadcaster, initCfg);
    /* Restore custom minimap drag-to-resize width from workspace state (overrides preset) */
    const customMmPx = context.workspaceState.get('saropaLogCapture.minimapCustomPx');
    if (typeof customMmPx === 'number' && customMmPx >= 20 && customMmPx <= 160) {
        broadcaster.postToWebview({ type: 'minimapWidthPx', px: customMmPx });
    }
    (0, activation_listeners_1.setupConfigListener)(context, sessionManager, broadcaster, captureToggle);
    (0, activation_listeners_1.setupLineListeners)({ context, sessionManager, broadcaster, historyProvider, inlineDecorations });
    (0, activation_listeners_1.setupScopeContextListener)(context, broadcaster);
    (0, activation_listeners_1.setupDiagnosticListener)(context, diagnosticCache, broadcaster);
    const displayKey = 'slc.sessionDisplayOptions';
    const stored = context.workspaceState.get(displayKey, {});
    const displayOpts = {
        ...session_display_1.defaultDisplayOptions,
        ...stored,
        sessionListPageSize: stored.sessionListPageSize ?? initCfg.sessionListPageSize ?? session_display_1.defaultDisplayOptions.sessionListPageSize ?? 100,
    };
    historyProvider.setDisplayOptions(displayOpts);
    broadcaster.sendDisplayOptions(displayOpts);
    viewerProvider.setDisplayOptionsHandler(async (options) => {
        await context.workspaceState.update(displayKey, options);
        historyProvider.setDisplayOptions(options);
        historyProvider.refresh();
        broadcaster.sendDisplayOptions(options);
    });
    const onOpenBookmark = async (fileUri, lineIndex) => {
        await viewerProvider.loadFromFile(vscode.Uri.parse(fileUri));
        viewerProvider.scrollToLine(lineIndex + 1);
    };
    const openSessionForReplay = async (uri) => {
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
        await viewerProvider.loadFromFile(uri, { replay: true });
    };
    const onFirstSessionListReady = (items) => {
        if (viewerProvider.getCurrentFileUri()) {
            return;
        }
        if (historyProvider.getActiveUri()) {
            return;
        }
        void (0, extension_activation_helpers_1.autoLoadLatest)(context, items, viewerProvider);
    };
    const handlerDeps = { sessionManager, broadcaster, historyProvider, bookmarkStore, context, onOpenBookmark, openSessionForReplay, onFirstSessionListReady };
    (0, viewer_handler_wiring_1.wireSharedHandlers)(viewerProvider, handlerDeps);
    (0, viewer_handler_wiring_1.wireSharedHandlers)(popOutPanel, handlerDeps);
    const { updateSessionNav } = (0, extension_activation_handlers_1.wireViewerSpecificHandlers)({
        viewerProvider, historyProvider, bookmarkStore, popOutPanel, context, version,
    });
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', new tracker_1.SaropaTrackerFactory(sessionManager)));
    const aiWatcher = new ai_watcher_1.AiWatcher(outputChannel);
    context.subscriptions.push(aiWatcher);
    aiWatcher.onEntries((entries) => {
        const cfg = (0, config_1.getConfig)().aiActivity;
        for (const entry of (0, ai_line_formatter_1.filterAiEntries)(entries, cfg)) {
            broadcaster.addLine((0, ai_line_formatter_1.formatAiEntry)(entry));
        }
    });
    // Session-group tracker \u2014 watches DAP start/stop and stamps related files with a shared groupId.
    // Reads settings fresh on every call so users can tune lookback seconds mid-session without reloading.
    const sessionGroupTracker = new session_group_tracker_1.SessionGroupTracker({
        metaStore: historyProvider.getMetaStore(),
        getSettings: () => (0, config_1.getConfig)().sessionGroups,
        log: (msg) => outputChannel.appendLine(msg),
    });
    // Expose the tracker to the retention sweep so it can skip active groups and expand closed
    // groups atomically. File-retention doesn't see the tracker via a normal parameter chain
    // (that would churn four interfaces for one optional hook); the module-level holder is the
    // sanctioned workaround.
    (0, file_retention_1.setRetentionGroupContext)({ getActiveGroupId: () => sessionGroupTracker.getActiveGroupId() });
    (0, extension_lifecycle_1.registerDebugLifecycle)({ context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider, updateSessionNav, aiWatcher, fireSessionStart: apiHandle.fireSessionStart, fireSessionEnd: apiHandle.fireSessionEnd, sessionGroupTracker });
    (0, commands_1.registerCommands)({
        context,
        sessionManager,
        viewerProvider,
        historyProvider,
        inlineDecorations,
        popOutPanel,
        collectionStore,
        broadcaster,
    }, captureToggle);
    (0, learning_notifications_1.scheduleLearningSuggestionCheck)(context, broadcaster);
    (0, activation_providers_1.registerNoRestoreSerializers)(context);
    if (folder) {
        (0, crashlytics_io_1.migrateCrashlyticsCacheToSaropa)(folder).catch(() => { });
        (0, gitignore_checker_1.checkGitignoreSaropa)(context, folder).catch(() => { });
        // Clean up orphan .meta.json sidecars left by older versions (scans workspace root).
        (0, session_metadata_1.migrateSidecarsInDirectory)(folder.uri, folder).catch(() => { });
    }
    (0, extension_activation_helpers_1.showWalkthroughOnFirstInstall)(context);
    (0, ai_auto_enable_1.scheduleMaybeAutoEnableAiFromLanguageModels)();
    outputChannel.appendLine('Saropa Log Capture activated.');
    return {
        api: apiHandle.api,
        disposeApi: apiHandle.dispose,
        fireSessionStart: apiHandle.fireSessionStart,
        fireSessionEnd: apiHandle.fireSessionEnd,
        sessionManager,
        projectIndexer,
        popOutPanel,
    };
}
//# sourceMappingURL=extension-activation.js.map