/**
 * Extension activation logic — provider registration, handlers, config, lifecycle.
 * Extracted from extension.ts to keep the entry point under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './modules/config/config';
import { SaropaTrackerFactory } from './modules/capture/tracker';
import { SessionManagerImpl } from './modules/session/session-manager';
import { StatusBar } from './ui/shared/status-bar';
import { SessionHistoryProvider } from './ui/session/session-history-provider';
import { createUriHandler } from './modules/features/deep-links';
import { importFromGist, importFromUrl } from './modules/share/gist-importer';
import { clearGitHubToken } from './modules/share/github-auth';
import { applyInitialBroadcasterConfig } from './activation-broadcaster-config';
import { registerCommands } from './commands';
import { SessionDisplayOptions, defaultDisplayOptions } from './ui/session/session-display';
import { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import { PopOutPanel } from './ui/viewer-panels/pop-out-panel';
import { openSignalTab } from './ui/viewer-panels/signal-tab-panel';
import { wireSharedHandlers, SESSION_PANEL_ROOT_KEY } from './ui/provider/viewer-handler-wiring';
import { checkGitignoreSaropa } from './modules/config/gitignore-checker';
import { migrateCrashlyticsCacheToSaropa } from './modules/crashlytics/crashlytics-io';
import { migrateSidecarsInDirectory } from './modules/session/session-metadata';
import { ProjectIndexer, setGlobalProjectIndexer } from './modules/project-indexer/project-indexer';
import { searchLogFilesConcurrent } from './modules/search/log-search';
import { BookmarkStore } from './modules/storage/bookmark-store';
import { buildSessionListPayload, LOG_LAST_VIEWED_KEY, updateLastViewed } from './ui/provider/viewer-provider-helpers';
import { registerDebugLifecycle } from './extension-lifecycle';
import { AiWatcher } from './modules/ai/ai-watcher';
import { formatAiEntry, filterAiEntries } from './modules/ai/ai-line-formatter';
import { registerAllIntegrations } from './activation-integrations';
import { createApi } from './api';
import type { SaropaLogCaptureApi, SaropaSessionEvent } from './api-types';
import { InvestigationStore } from './modules/investigation/investigation-store';
import { disposeInvestigationPanel } from './ui/investigation/investigation-panel';
import { setupWebviewProviders, registerNoRestoreSerializers } from './activation-providers';
import { setupLineListeners, setupConfigListener, setupScopeContextListener, setupDiagnosticListener } from './activation-listeners';
import { DiagnosticCache } from './modules/diagnostics/diagnostic-cache';
import { autoLoadLatest, maybeSuggestSmartBookmark, showWalkthroughOnFirstInstall } from './extension-activation-helpers';
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
    context.subscriptions.push(statusBar, outputChannel);

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

    registerAllIntegrations();

    // Watch workspace root for Flutter CLI crash logs (flutter_*.log) and import to reports.
    if (folder && (getConfig().integrationsAdapters ?? []).includes('flutterCrashLogs')) {
        context.subscriptions.push(startFlutterCrashWatcher(folder, outputChannel));
    }

    const version = String(context.extension.packageJSON.version ?? '');
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
    historyProvider.onDidChangeTreeData(async () => {
        const overrideUriStr = context.workspaceState.get<string>(SESSION_PANEL_ROOT_KEY);
        if (overrideUriStr) { return; }
        const defaultLabel = folder ? getLogDirectoryUri(folder).fsPath : 'No workspace';
        broadcaster.sendSessionListLoading(defaultLabel);
        const items = await historyProvider.getAllChildren();
        const lastViewedMap = context.workspaceState.get<Record<string, number>>(LOG_LAST_VIEWED_KEY, {});
        const payload = await buildSessionListPayload(items, historyProvider.getActiveUri(), {
            getActiveLastWriteTime: () => sessionManager.getActiveLastWriteTime?.(),
            getLastViewedAt: (uri) => lastViewedMap[uri],
        });
        broadcaster.sendSessionList(payload, { label: defaultLabel, path: defaultLabel, isDefault: true });
    });

    const bookmarkStore = new BookmarkStore(context);
    context.subscriptions.push(bookmarkStore);
    bookmarkStore.onDidChange(() => { broadcaster.sendBookmarkList(bookmarkStore.getAll() as Record<string, unknown>); });

    const investigationStore = new InvestigationStore(context);
    context.subscriptions.push(investigationStore, { dispose: disposeInvestigationPanel });

    const importHandlers = {
        importFromGist: (gistId: string) => importFromGist(gistId, investigationStore),
        importFromUrl: (url: string) => importFromUrl(url, investigationStore),
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

    setupConfigListener(context, sessionManager, broadcaster);
    setupLineListeners({ context, sessionManager, broadcaster, historyProvider, inlineDecorations });
    setupScopeContextListener(context, broadcaster);
    setupDiagnosticListener(context, diagnosticCache, broadcaster);

    const displayKey = 'slc.sessionDisplayOptions';
    const stored = context.workspaceState.get<Partial<SessionDisplayOptions>>(displayKey, {});
    const displayOpts: SessionDisplayOptions = {
        ...defaultDisplayOptions,
        ...stored,
        sessionListPageSize: stored.sessionListPageSize ?? initCfg.sessionListPageSize ?? defaultDisplayOptions.sessionListPageSize ?? 100,
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
    const openSessionForReplay = async (uri: vscode.Uri): Promise<void> => {
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
        await viewerProvider.loadFromFile(uri, { replay: true });
    };
    const onFirstSessionListReady = (items: readonly import('./ui/session/session-history-grouping').TreeItem[]): void => {
        if (viewerProvider.getCurrentFileUri()) { return; }
        if (historyProvider.getActiveUri()) { return; }
        void autoLoadLatest(context, items, viewerProvider);
    };
    const handlerDeps = { sessionManager, broadcaster, historyProvider, bookmarkStore, context, onOpenBookmark, openSessionForReplay, onFirstSessionListReady };
    wireSharedHandlers(viewerProvider, handlerDeps);
    wireSharedHandlers(popOutPanel, handlerDeps);

    const updateSessionNav = async (): Promise<void> => {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { viewerProvider.setSessionNavInfo(false, false, 0, 0); return; }
        const adj = await historyProvider.getAdjacentSessions(uri);
        viewerProvider.setSessionNavInfo(!!adj.prev, !!adj.next, adj.index, adj.total);
    };
    const smartBookmarkSuggestedForUri = new Set<string>();
    viewerProvider.setFileLoadedHandler((uri, loadResult) => {
        void updateSessionNav();
        const isActive = historyProvider.getActiveUri()?.toString() === uri.toString();
        if (isActive) {
            void maybeSuggestSmartBookmark(uri, loadResult, bookmarkStore, smartBookmarkSuggestedForUri);
        }
    });
    viewerProvider.setSessionNavigateHandler(async (direction) => {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { return; }
        const adj = await historyProvider.getAdjacentSessions(uri);
        const target = direction < 0 ? adj.prev : adj.next;
        if (target) { await viewerProvider.loadFromFile(target); }
    });

    viewerProvider.setBecameVisibleHandler(() => {
        // Active session always takes priority.
        const activeUri = historyProvider.getActiveUri();
        if (activeUri) {
            if (viewerProvider.getCurrentFileUri()?.toString() === activeUri.toString()) { return; }
            void viewerProvider.loadFromFile(activeUri);
            return;
        }
    });

    viewerProvider.setOpenSessionFromPanelHandler(async (uriString) => {
        if (!uriString) { return; }
        await viewerProvider.loadFromFile(vscode.Uri.parse(uriString));
        await updateLastViewed(context, uriString);
    });
    viewerProvider.setPopOutHandler(() => { void popOutPanel.open(); });
    viewerProvider.setOpenSignalTabHandler(() => {
        openSignalTab({
            getCurrentFileUri: () => viewerProvider.getCurrentFileUri(),
            context,
            extensionUri: context.extensionUri,
            version,
        });
    });
    viewerProvider.setRevealLogFileHandler(async () => {
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
    });
    viewerProvider.setFindInFilesHandler(async (query, options) => {
        const results = await searchLogFilesConcurrent(query, {
            caseSensitive: Boolean(options.caseSensitive),
            useRegex: Boolean(options.useRegex),
            wholeWord: Boolean(options.wholeWord),
        });
        viewerProvider.sendFindResults(results);
    });
    viewerProvider.setOpenFindResultHandler(async (uriString, query, options) => {
        if (!uriString) { return; }
        await viewerProvider.loadFromFile(vscode.Uri.parse(uriString));
        viewerProvider.setupFindSearch(query, options);
    });
    viewerProvider.setFindNavigateMatchHandler(() => { viewerProvider.findNextMatch(); });

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

    registerDebugLifecycle({ context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider, updateSessionNav, aiWatcher, fireSessionStart: apiHandle.fireSessionStart, fireSessionEnd: apiHandle.fireSessionEnd });
    registerCommands({
        context,
        sessionManager,
        viewerProvider,
        historyProvider,
        inlineDecorations,
        popOutPanel,
        investigationStore,
        broadcaster,
    });

    scheduleLearningSuggestionCheck(context, broadcaster);

    registerNoRestoreSerializers(context);

    if (folder) {
        migrateCrashlyticsCacheToSaropa(folder).catch(() => {});
        checkGitignoreSaropa(context, folder).catch(() => {});
        // Clean up orphan .meta.json sidecars left by older versions (scans workspace root).
        migrateSidecarsInDirectory(folder.uri, folder).catch(() => {});
    }

    showWalkthroughOnFirstInstall(context);

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

