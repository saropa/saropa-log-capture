/**
 * Extension activation logic — provider registration, handlers, config, lifecycle.
 * Extracted from extension.ts to keep the entry point under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './modules/config/config';
import { SaropaTrackerFactory } from './modules/capture/tracker';
import { SessionManagerImpl } from './modules/session/session-manager';
import { StatusBar } from './ui/shared/status-bar';
import { CaptureToggleStatusBar } from './ui/shared/capture-toggle-status-bar';
import { SessionHistoryProvider } from './ui/session/session-history-provider';
import { createUriHandler } from './modules/features/deep-links';
import { importFromGist, importFromUrl } from './modules/share/gist-importer';
import { clearGitHubToken } from './modules/share/github-auth';
import { applyInitialBroadcasterConfig } from './activation-broadcaster-config';
import { registerCommands } from './commands';
import { SessionDisplayOptions, defaultDisplayOptions } from './ui/session/session-display';
import { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import { PopOutPanel } from './ui/viewer-panels/pop-out-panel';
import { wireViewerSpecificHandlers } from './extension-activation-handlers';
import { wireSharedHandlers, SESSION_PANEL_ROOT_KEY } from './ui/provider/viewer-handler-wiring';
import { checkGitignoreSaropa } from './modules/config/gitignore-checker';
import { migrateCrashlyticsCacheToSaropa } from './modules/crashlytics/crashlytics-io';
import { migrateSidecarsInDirectory } from './modules/session/session-metadata';
import { ProjectIndexer, setGlobalProjectIndexer } from './modules/project-indexer/project-indexer';
import { TrigramSearchIndex, setGlobalSearchIndex } from './modules/search/search-trigram-index';
import { BookmarkStore } from './modules/storage/bookmark-store';
import { buildSessionListPayload, buildClassifierInputs, buildRoleClassifier, LOG_LAST_VIEWED_KEY, getOrSeedDismissedAt } from './ui/provider/viewer-provider-helpers';
import { computeLogContextInfo, shouldAutoSwitchToLatest } from './ui/provider/viewer-log-context';
import { registerDebugLifecycle } from './extension-lifecycle';
import { SessionGroupTracker } from './modules/session/session-group-tracker';
import { setRetentionGroupContext } from './modules/config/file-retention';
import { AiWatcher } from './modules/ai/ai-watcher';
import { formatAiEntry, filterAiEntries } from './modules/ai/ai-line-formatter';
import { registerAllIntegrations } from './activation-integrations';
import { createApi } from './api';
import type { SaropaLogCaptureApi, SaropaSessionEvent } from './api-types';
import { CollectionStore } from './modules/collection/collection-store';
import { disposeCollectionPanel } from './ui/collection/collection-panel';
import { setupWebviewProviders, registerNoRestoreSerializers } from './activation-providers';
import { setupLineListeners, setupConfigListener, setupScopeContextListener, setupDiagnosticListener } from './activation-listeners';
import { DiagnosticCache } from './modules/diagnostics/diagnostic-cache';
import { autoLoadInitialLog, showWalkthroughOnFirstInstall } from './extension-activation-helpers';
import { ErrorSnackbarNotifier } from './modules/features/error-snackbar';
import { showBugReport } from './ui/panels/bug-report-panel';
import { maybeNotifyPartialNlsCoverage } from './l10n/nls-coverage-notice';
import { maybeNotifySilentSiblings } from './modules/diagnostics/suite-silent-notice';
import { maybeRecommendAdapters } from './modules/integrations/recommend-adapters-notice';
import { initLearningRuntime, flushLearningBuffer } from './modules/learning/learning-runtime';
import { scheduleLearningSuggestionCheck } from './modules/learning/learning-notifications';
import { scheduleMaybeAutoEnableAiFromLanguageModels } from './modules/ai/ai-auto-enable';
import { startFlutterCrashWatcher } from './modules/integrations/flutter-crash-watcher';

export interface ActivationRefs {
    readonly api: SaropaLogCaptureApi;
    readonly disposeApi: () => void;
    readonly fireSessionStart: (event: SaropaSessionEvent) => void;
    readonly fireSessionEnd: (event: SaropaSessionEvent) => void;
    sessionManager: SessionManagerImpl;
    projectIndexer: ProjectIndexer | null;
    popOutPanel: PopOutPanel;
}


export function runActivation(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): ActivationRefs {
    const statusBar = new StatusBar();
    const captureToggle = new CaptureToggleStatusBar(getConfig().enabled);
    context.subscriptions.push(statusBar, captureToggle, outputChannel);

    const sessionManager = new SessionManagerImpl(statusBar, outputChannel);
    initLearningRuntime(context, sessionManager);
    context.subscriptions.push({ dispose: () => { void flushLearningBuffer(); } });
    const apiHandle = createApi(sessionManager);

    const folder = vscode.workspace.workspaceFolders?.[0];
    let projectIndexer: ProjectIndexer | null = null;
    if (folder && getConfig().projectIndex.enabled) {
        projectIndexer = new ProjectIndexer(folder);
        setGlobalProjectIndexer(projectIndexer);
        sessionManager.setProjectIndexer(projectIndexer);
        projectIndexer.startWatching();
        context.subscriptions.push({ dispose: () => { projectIndexer?.dispose(); projectIndexer = null; setGlobalProjectIndexer(null); } });
    }

    // Trigram search index (plan 029): registered whenever a workspace folder is open; the
    // searchIndex.enabled setting is checked per-operation, so toggling it needs no reactivation.
    if (folder) {
        setGlobalSearchIndex(new TrigramSearchIndex(folder));
        context.subscriptions.push({ dispose: () => setGlobalSearchIndex(null) });
    }

    registerAllIntegrations();

    // Watch workspace root for Flutter CLI crash logs (flutter_*.log) and import to reports.
    if (folder && (getConfig().integrationsAdapters ?? []).includes('flutterCrashLogs')) {
        context.subscriptions.push(startFlutterCrashWatcher(folder, outputChannel));
    }

    const version = String(context.extension.packageJSON.version ?? '');
    // Baseline for "a newer log ARRIVED" (plan 111). Only controller logs written after this window
    // activated may auto-switch the viewer; logs already on disk at startup must not, or they would
    // override the last-viewed log restored by autoLoadInitialLog on the first reports/ watcher event.
    const activatedAtMs = Date.now();
    const { viewerProvider, inlineDecorations } = setupWebviewProviders(context, version);

    const broadcaster = new ViewerBroadcaster();
    const diagnosticCache = new DiagnosticCache();
    diagnosticCache.activate(context.subscriptions);
    broadcaster.setDiagnosticCache(diagnosticCache);

    const popOutPanel = new PopOutPanel({
      extensionUri: context.extensionUri,
      version,
      context,
      broadcaster,
      getHydrationUri: () => viewerProvider.getCurrentFileUri(),
    });
    broadcaster.addTarget(viewerProvider);
    broadcaster.addTarget(popOutPanel);
    context.subscriptions.push(popOutPanel);

    const historyProvider = new SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    // Feed the history tree's active-session count from the write queue's write-time callback, so the
    // displayed count can't lag the file by the queue depth (M1). The per-line listener no longer sets it.
    sessionManager.setActiveLineCountObserver((n) => historyProvider.setActiveLineCount(n));
    historyProvider.onDidChangeTreeData(async () => {
        const overrideUriStr = context.workspaceState.get<string>(SESSION_PANEL_ROOT_KEY);
        if (overrideUriStr) { return; }
        const defaultLabel = folder ? getLogDirectoryUri(folder).fsPath : 'No workspace';
        broadcaster.sendSessionListLoading(defaultLabel);
        const items = await historyProvider.getAllChildren();
        const lastViewedMap = context.workspaceState.get<Record<string, number>>(LOG_LAST_VIEWED_KEY, {});
        // Classify kind + role here too (not just in makePayloadOptions): this tree-change refresh
        // feeds the same panel, so omitting the classifiers would flatten every Controller back to a
        // peripheral on the next refresh and flicker the tree. Folder name drives the controller match.
        const cfg = getConfig();
        const refreshFolderName = folder?.name;
        // Feed the dismiss cursor here too — this proactive refresh fires when a new log is written
        // (the exact moment the banner should appear), and it is the path that supplies the
        // always-visible log-viewer banner with unreadSinceFocus without the user opening the panel.
        const dismissedAt = getOrSeedDismissedAt(context);
        const payload = await buildSessionListPayload(items, historyProvider.getActiveUri(), {
            getActiveLastWriteTime: () => sessionManager.getActiveLastWriteTime?.(),
            getLastViewedAt: (uri) => lastViewedMap[uri],
            getDismissedAt: () => dismissedAt,
            classifyMeta: buildClassifierInputs(cfg.reportsClassifier.kindPatterns, refreshFolderName),
            classifyRole: buildRoleClassifier(cfg.reportsClassifier.controllerNames, refreshFolderName),
        });
        broadcaster.sendSessionList(payload, { label: defaultLabel, path: defaultLabel, isDefault: true });
        // Recompute the open log's staleness the instant a new log is written (this refresh is the
        // moment a newer controller log can appear). Reuses the same items/cfg/cursor just gathered.
        const logContext = computeLogContextInfo({
            items,
            currentUri: viewerProvider.getCurrentFileUri()?.toString(),
            controllerNames: cfg.reportsClassifier.controllerNames,
            workspaceFolderName: refreshFolderName,
            dismissedAt,
        });
        broadcaster.setLogContextInfo(logContext);
        // "Always switch to latest" (default on): upgrade the passive banner to an active switch. This
        // refresh is the exact moment a newer controller log appears, so load it here instead of
        // waiting for the user to click the banner's Open. The decision predicate is pure/extracted so
        // it is unit-testable without the Extension Host (see shouldAutoSwitchToLatest).
        if (shouldAutoSwitchToLatest(logContext, cfg.newerLogAlert.autoSwitch, activatedAtMs)) {
            // Deliberately a NON-tail load. A live-streaming session is always its own currentUri
            // (broadcaster.setCurrentFile in applySessionStartedState marks it) and therefore the
            // newest controller, so this branch only ever targets a finished / other-window log — never
            // the active tail. Adding { tail: true } here would start a second tail on a static file
            // and risk fighting the live session's tail; the plain load is correct.
            void viewerProvider.loadFromFile(vscode.Uri.parse(logContext.latestUri));
        }
    });

    const bookmarkStore = new BookmarkStore(context);
    context.subscriptions.push(bookmarkStore);
    bookmarkStore.onDidChange(() => { broadcaster.sendBookmarkList(bookmarkStore.getAll() as Record<string, unknown>); });

    const collectionStore = new CollectionStore(context);
    context.subscriptions.push(collectionStore, { dispose: disposeCollectionPanel });

    const importHandlers = {
        importFromGist: (gistId: string) => importFromGist(gistId, collectionStore),
        importFromUrl: (url: string) => importFromUrl(url, collectionStore),
    };
    context.subscriptions.push(
        vscode.window.registerUriHandler(createUriHandler(importHandlers)),
        vscode.authentication.onDidChangeSessions(async (e) => {
            if (e.provider.id !== 'github') { return; }
            const session = await vscode.authentication.getSession('github', [], { createIfNone: false });
            if (!session) {
                await clearGitHubToken(context);
            }
        }),
    );

    const initCfg = getConfig();
    applyInitialBroadcasterConfig(broadcaster, initCfg);

    /* Restore custom minimap drag-to-resize width from workspace state (overrides preset) */
    const customMmPx = context.workspaceState.get<number>('saropaLogCapture.minimapCustomPx');
    if (typeof customMmPx === 'number' && customMmPx >= 20 && customMmPx <= 160) {
        broadcaster.postToWebview({ type: 'minimapWidthPx', px: customMmPx });
    }

    setupConfigListener(context, sessionManager, broadcaster, captureToggle);
    setupLineListeners({ context, sessionManager, broadcaster, historyProvider, inlineDecorations });
    setupScopeContextListener(context, broadcaster);
    setupDiagnosticListener(context, diagnosticCache, broadcaster);

    const displayKey = 'slc.sessionDisplayOptions';
    const stored = context.workspaceState.get<Partial<SessionDisplayOptions>>(displayKey, {});
    const displayOpts: SessionDisplayOptions = {
        ...defaultDisplayOptions,
        ...stored,
        sessionListPageSize: stored.sessionListPageSize ?? initCfg.sessionListPageSize ?? defaultDisplayOptions.sessionListPageSize ?? 100,
        // Reports bucket + newer-log alert: persisted user state wins; otherwise fall back to the
        // per-workspace setting; otherwise to the global default. Reading the setting at activation
        // (not per-render) is fine because the webview also receives sendDisplayOptions whenever
        // the user flips one of these via the toolbar. Plan: 001.
        reportsBucketState: stored.reportsBucketState ?? initCfg.reportsClassifier.bucketDefault,
        newerLogBannerEnabled: stored.newerLogBannerEnabled ?? initCfg.newerLogAlert.bannerEnabled,
        newerLogDotEnabled: stored.newerLogDotEnabled ?? initCfg.newerLogAlert.dotEnabled,
    };
    historyProvider.setDisplayOptions(displayOpts);
    broadcaster.sendDisplayOptions(displayOpts);
    viewerProvider.setDisplayOptionsHandler(async (options) => {
        await context.workspaceState.update(displayKey, options);
        historyProvider.setDisplayOptions(options);
        historyProvider.refresh();
        broadcaster.sendDisplayOptions(options);
    });

    const onOpenBookmark = async (fileUri: string, lineIndex: number): Promise<void> => {
        await viewerProvider.loadFromFile(vscode.Uri.parse(fileUri));
        viewerProvider.scrollToLine(lineIndex + 1);
    };

    /* Live error snackbars (opt-in via saropaLogCapture.showErrorSnackbars). The notifier reads
       the setting fresh per line, so no config-change wiring is needed. Buttons reuse the same
       load-then-scroll path as bookmarks (Open Log) and the existing bug-report webview (Error
       Report). Registered as a second line listener so activation-listeners.ts stays untouched. */
    const errorSnackbar = new ErrorSnackbarNotifier({
        /* Read only this one key, not the full getConfig() object. This runs per captured line
           (even when the feature is off), and getConfig() rebuilds all ~256 settings through their
           normalizers every call — far too heavy for the live firehose. A single get() is fresh
           (honors runtime toggles) without the rebuild. */
        isEnabled: () => vscode.workspace.getConfiguration('saropaLogCapture').get<boolean>('showErrorSnackbars', false),
        // logFileUri is session.fileUri.fsPath (a filesystem path), NOT a URI string — so it must go
        // through Uri.file, not Uri.parse (Uri.parse would read the Windows drive letter as a scheme).
        openLogAtLine: async (logFileUri, line) => {
            await viewerProvider.loadFromFile(vscode.Uri.file(logFileUri));
            viewerProvider.scrollToLine(line); // already 1-based
        },
        openReport: (text, lineIndex, logFileUri) =>
            showBugReport(text, lineIndex, vscode.Uri.file(logFileUri), context),
    });
    sessionManager.addLineListener((data) => errorSnackbar.onLine(data));
    const openSessionForReplay = async (uri: vscode.Uri): Promise<void> => {
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
        await viewerProvider.loadFromFile(uri, { replay: true });
    };
    const onFirstSessionListReady = (items: readonly import('./ui/session/session-history-grouping').TreeItem[]): void => {
        if (viewerProvider.getCurrentFileUri()) { return; }
        if (historyProvider.getActiveUri()) { return; }
        void autoLoadInitialLog(context, items, viewerProvider);
    };
    const handlerDeps = { sessionManager, broadcaster, historyProvider, bookmarkStore, context, onOpenBookmark, openSessionForReplay, onFirstSessionListReady };
    wireSharedHandlers(viewerProvider, handlerDeps);
    wireSharedHandlers(popOutPanel, handlerDeps);

    // Reset the watcher's running totals when the user acknowledges the badge,
    // so the badge only counts hits since the last time the panel was focused.
    viewerProvider.setWatchAcknowledgedHandler(() => sessionManager.getWatcher().resetCounts());

    const { refreshLogContext } = wireViewerSpecificHandlers({
        viewerProvider, historyProvider, bookmarkStore, popOutPanel, broadcaster, outputChannel, context, version,
    });

    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory('*', new SaropaTrackerFactory(sessionManager)),
    );

    const aiWatcher = new AiWatcher(outputChannel);
    context.subscriptions.push(aiWatcher);
    aiWatcher.onEntries((entries) => {
        const cfg = getConfig().aiActivity;
        for (const entry of filterAiEntries(entries, cfg)) {
            broadcaster.addLine(formatAiEntry(entry));
        }
    });

    // Session-group tracker \u2014 watches DAP start/stop and stamps related files with a shared groupId.
    // Reads settings fresh on every call so users can tune lookback seconds mid-session without reloading.
    const sessionGroupTracker = new SessionGroupTracker({
        metaStore: historyProvider.getMetaStore(),
        getSettings: () => getConfig().sessionGroups,
        log: (msg: string) => outputChannel.appendLine(msg),
    });
    // Expose the tracker to the retention sweep so it can skip active groups and expand closed
    // groups atomically. File-retention doesn't see the tracker via a normal parameter chain
    // (that would churn four interfaces for one optional hook); the module-level holder is the
    // sanctioned workaround.
    setRetentionGroupContext({ getActiveGroupId: () => sessionGroupTracker.getActiveGroupId() });
    registerDebugLifecycle({ context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider, refreshLogContext, aiWatcher, fireSessionStart: apiHandle.fireSessionStart, fireSessionEnd: apiHandle.fireSessionEnd, sessionGroupTracker });
    registerCommands({
        context,
        sessionManager,
        viewerProvider,
        historyProvider,
        inlineDecorations,
        popOutPanel,
        collectionStore,
        broadcaster,
    }, captureToggle);

    scheduleLearningSuggestionCheck(context, broadcaster);

    registerNoRestoreSerializers(context);

    if (folder) {
        migrateCrashlyticsCacheToSaropa(folder).catch(() => {});
        checkGitignoreSaropa(context, folder).catch(() => {});
        // Clean up orphan .meta.json sidecars left by older versions (scans workspace root).
        migrateSidecarsInDirectory(folder.uri, folder).catch(() => {});
        // Offer to turn on integration adapters the workspace's pubspec packages imply.
        void maybeRecommendAdapters(context, folder);
    }

    showWalkthroughOnFirstInstall(context);

    // Tell the user once if their editor's display language has largely-English chrome.
    maybeNotifyPartialNlsCoverage(context);

    // If a suite sibling is installed but hasn't shared its diagnostics mirror, try to refresh it
    // and otherwise tell the user once — the integration is invisible until the mirror exists.
    void maybeNotifySilentSiblings(context);

    scheduleMaybeAutoEnableAiFromLanguageModels();

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

