/**
 * Extension activation logic — provider registration, handlers, config, lifecycle.
 * Extracted from extension.ts to keep the entry point under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig } from './modules/config/config';
import { SaropaTrackerFactory } from './modules/capture/tracker';
import { SessionManagerImpl } from './modules/session/session-manager';
import { StatusBar } from './ui/shared/status-bar';
import { LogViewerProvider } from './ui/provider/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session/session-history-provider';
import { createUriHandler } from './modules/features/deep-links';
import { loadPresets } from './modules/storage/filter-presets';
import { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import { extractSourceReference } from './modules/source/source-linker';
import { CrashlyticsCodeLensProvider } from './ui/shared/crashlytics-codelens';
import { VitalsPanelProvider } from './ui/panels/vitals-panel';
import { registerCommands } from './commands';
import { SessionDisplayOptions, defaultDisplayOptions } from './ui/session/session-display';
import { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import { PopOutPanel } from './ui/viewer-panels/pop-out-panel';
import { wireSharedHandlers, SESSION_PANEL_ROOT_KEY } from './ui/provider/viewer-handler-wiring';
import { getLogDirectoryUri } from './modules/config/config';
import { checkGitignoreSaropa } from './modules/config/gitignore-checker';
import { migrateCrashlyticsCacheToSaropa } from './modules/crashlytics/crashlytics-io';
import { ProjectIndexer, setGlobalProjectIndexer } from './modules/project-indexer/project-indexer';
import { searchLogFilesConcurrent } from './modules/search/log-search';
import { BookmarkStore } from './modules/storage/bookmark-store';
import { buildSessionListPayload } from './ui/provider/viewer-provider-helpers';
import { buildScopeContext } from './modules/storage/scope-context';
import { registerDebugLifecycle } from './extension-lifecycle';
import { AiWatcher } from './modules/ai/ai-watcher';
import { formatAiEntry, filterAiEntries } from './modules/ai/ai-line-formatter';
import { registerAllIntegrations } from './activation-integrations';

export interface ActivationRefs {
    sessionManager: SessionManagerImpl;
    projectIndexer: ProjectIndexer | null;
    popOutPanel: PopOutPanel;
}

export function runActivation(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): ActivationRefs {
    // --- Status bar & session manager ---
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar, outputChannel);

    const sessionManager = new SessionManagerImpl(statusBar, outputChannel);

    // --- Project indexer (optional; indexes reports for docs/reports) ---
    const folder = vscode.workspace.workspaceFolders?.[0];
    let projectIndexer: ProjectIndexer | null = null;
    if (folder && getConfig().projectIndex.enabled) {
        projectIndexer = new ProjectIndexer(folder);
        setGlobalProjectIndexer(projectIndexer);
        sessionManager.setProjectIndexer(projectIndexer);
        projectIndexer.startWatching();
        context.subscriptions.push({ dispose: () => { projectIndexer?.dispose(); projectIndexer = null; setGlobalProjectIndexer(null); } });
    }

    // --- Integration registry (session start/end contributions; see docs/integrations/INTEGRATION_API.md) ---
    registerAllIntegrations();

    // --- Webview providers: sidebar viewer, vitals, pop-out ---
    const inlineDecorations = new InlineDecorationsProvider();
    context.subscriptions.push(inlineDecorations);

    const version = String(context.extension.packageJSON.version ?? '');
    const viewerProvider = new LogViewerProvider(context.extensionUri, version, context);
    context.subscriptions.push(viewerProvider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );

    const vitalsPanel = new VitalsPanelProvider();
    context.subscriptions.push(vitalsPanel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VitalsPanelProvider.viewType, vitalsPanel),
    );
    context.subscriptions.push(vscode.commands.registerCommand(
        'saropaLogCapture.refreshVitals', () => vitalsPanel.refresh(),
    ));

    const crashCodeLens = new CrashlyticsCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, crashCodeLens));

    // --- Broadcaster & session list: single fan-out to sidebar and pop-out ---
    const broadcaster = new ViewerBroadcaster();
    const popOutPanel = new PopOutPanel(context.extensionUri, version, context, broadcaster);
    broadcaster.addTarget(viewerProvider);
    broadcaster.addTarget(popOutPanel);
    context.subscriptions.push(popOutPanel);

    const historyProvider = new SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    historyProvider.onDidChangeTreeData(async () => {
        const overrideUriStr = context.workspaceState.get<string>(SESSION_PANEL_ROOT_KEY);
        if (overrideUriStr) { return; }
        const items = await historyProvider.getAllChildren();
        const payload = buildSessionListPayload(items, historyProvider.getActiveUri());
        const defaultLabel = folder ? getLogDirectoryUri(folder).fsPath : 'No workspace';
        broadcaster.sendSessionList(payload, { label: defaultLabel, path: defaultLabel, isDefault: true });
    });

    const bookmarkStore = new BookmarkStore(context);
    context.subscriptions.push(bookmarkStore);
    bookmarkStore.onDidChange(() => { broadcaster.sendBookmarkList(bookmarkStore.getAll() as Record<string, unknown>); });

    context.subscriptions.push(vscode.window.registerUriHandler(createUriHandler()));

    // --- Initial broadcaster state from config ---
    broadcaster.setPresets(loadPresets());
    const initCfg = getConfig();
    if (initCfg.highlightRules.length > 0) {
        broadcaster.setHighlightRules(initCfg.highlightRules);
    }
    broadcaster.setIconBarPosition(initCfg.iconBarPosition);
    broadcaster.setMinimapShowInfo(initCfg.minimapShowInfoMarkers);
    broadcaster.setMinimapWidth(initCfg.minimapWidth);

    // --- Config change listener: push updates to session manager and broadcaster ---
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('saropaLogCapture')) { return; }
        const cfg = getConfig();
        sessionManager.refreshConfig(cfg);
        if (e.affectsConfiguration('saropaLogCapture.iconBarPosition')) {
            broadcaster.setIconBarPosition(cfg.iconBarPosition);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowInfoMarkers')) {
            broadcaster.setMinimapShowInfo(cfg.minimapShowInfoMarkers);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapWidth')) {
            broadcaster.setMinimapWidth(cfg.minimapWidth);
        }
    }));

    const displayKey = 'slc.sessionDisplayOptions';
    const stored = context.workspaceState.get<Partial<SessionDisplayOptions>>(displayKey, {});
    const displayOpts: SessionDisplayOptions = { ...defaultDisplayOptions, ...stored };
    historyProvider.setDisplayOptions(displayOpts);
    broadcaster.sendDisplayOptions(displayOpts);
    viewerProvider.setDisplayOptionsHandler(async (options) => {
        await context.workspaceState.update(displayKey, options);
        historyProvider.setDisplayOptions(options);
        historyProvider.refresh();
        broadcaster.sendDisplayOptions(options);
    });

    // --- Line/split listeners: DAP output → broadcaster + history + inline decorations ---
    sessionManager.addLineListener((data) => {
        broadcaster.addLine(data);
        historyProvider.setActiveLineCount(data.lineCount);
        if (data.watchHits && data.watchHits.length > 0) {
            broadcaster.updateWatchCounts(sessionManager.getWatcher().getCounts());
        }
        if (!data.isMarker) {
            const sourceRef = extractSourceReference(data.text);
            if (sourceRef) {
                inlineDecorations.recordLogLine(
                    sourceRef.filePath,
                    sourceRef.line,
                    data.text,
                    data.category,
                );
            }
        }
    });
    sessionManager.addSplitListener((_newUri, partNumber, totalParts) => {
        broadcaster.setSplitInfo(partNumber, totalParts);
        const filename = sessionManager.getActiveFilename();
        if (filename) {
            broadcaster.setFilename(filename);
        }
        historyProvider.refresh();
    });

    // --- Shared handler wiring (marker, pause, exclusions, search, bookmarks, session list, etc.) ---
    const onOpenBookmark = async (fileUri: string, lineIndex: number): Promise<void> => {
        await viewerProvider.loadFromFile(vscode.Uri.parse(fileUri));
        viewerProvider.scrollToLine(lineIndex + 1);
    };
    const openSessionForReplay = async (uri: vscode.Uri): Promise<void> => {
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
        await viewerProvider.loadFromFile(uri, { replay: true });
    };
    const handlerDeps = { sessionManager, broadcaster, historyProvider, bookmarkStore, context, onOpenBookmark, openSessionForReplay };
    wireSharedHandlers(viewerProvider, handlerDeps);
    wireSharedHandlers(popOutPanel, handlerDeps);

    const updateSessionNav = async (): Promise<void> => {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { viewerProvider.setSessionNavInfo(false, false, 0, 0); return; }
        const adj = await historyProvider.getAdjacentSessions(uri);
        viewerProvider.setSessionNavInfo(!!adj.prev, !!adj.next, adj.index, adj.total);
    };
    viewerProvider.setFileLoadedHandler(() => { updateSessionNav().catch(() => {}); });
    viewerProvider.setSessionNavigateHandler(async (direction) => {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { return; }
        const adj = await historyProvider.getAdjacentSessions(uri);
        const target = direction < 0 ? adj.prev : adj.next;
        if (target) { await viewerProvider.loadFromFile(target); }
    });

    viewerProvider.setOpenSessionFromPanelHandler(async (uriString) => {
        if (!uriString) { return; }
        await viewerProvider.loadFromFile(vscode.Uri.parse(uriString));
    });
    viewerProvider.setPopOutHandler(() => { void popOutPanel.open(); });
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

    // --- DAP tracker factory: routes debug adapter output events to SessionManager ---
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory(
            '*',
            new SaropaTrackerFactory(sessionManager),
        ),
    );

    // --- AI activity watcher: optional stream of AI entries into the log viewer ---
    const aiWatcher = new AiWatcher(outputChannel);
    context.subscriptions.push(aiWatcher);
    aiWatcher.onEntries((entries) => {
        const cfg = getConfig().aiActivity;
        for (const entry of filterAiEntries(entries, cfg)) {
            broadcaster.addLine(formatAiEntry(entry));
        }
    });

    // --- Debug lifecycle (start/stop session) and command registration ---
    registerDebugLifecycle({ context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider, updateSessionNav, aiWatcher });
    registerCommands({ context, sessionManager, viewerProvider, historyProvider, inlineDecorations, popOutPanel });

    // --- Scope context for source-scope filter (updates on active editor change) ---
    const updateScopeContext = async (): Promise<void> => {
        const ctx = await buildScopeContext(vscode.window.activeTextEditor);
        broadcaster.setScopeContext(ctx);
    };
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => { updateScopeContext().catch(() => {}); }),
    );
    updateScopeContext().catch(() => {});

    // --- Webview panel serializers: do not restore state (dispose on reload) ---
    const noRestore: vscode.WebviewPanelSerializer = {
        deserializeWebviewPanel(p) { p.dispose(); return Promise.resolve(); },
    };
    for (const viewType of [
        'saropaLogCapture.insights', 'saropaLogCapture.bugReport',
        'saropaLogCapture.analysis', 'saropaLogCapture.timeline',
        'saropaLogCapture.comparison',
    ]) {
        context.subscriptions.push(
            vscode.window.registerWebviewPanelSerializer(viewType, noRestore),
        );
    }

    // --- Post-activation: one-off migrations and checks (non-blocking) ---
    if (folder) {
        migrateCrashlyticsCacheToSaropa(folder).catch(() => {});
        checkGitignoreSaropa(context, folder).catch(() => {});
    }

    outputChannel.appendLine('Saropa Log Capture activated.');
    return { sessionManager, projectIndexer, popOutPanel };
}
