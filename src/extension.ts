import * as vscode from 'vscode';
import { getConfig } from './modules/config';
import { SaropaTrackerFactory } from './modules/tracker';
import { SessionManagerImpl } from './modules/session-manager';
import { StatusBar } from './ui/status-bar';
import { LogViewerProvider } from './ui/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session-history-provider';
import { createUriHandler } from './modules/deep-links';
import { loadPresets } from './modules/filter-presets';
import { InlineDecorationsProvider } from './ui/inline-decorations';
import { extractSourceReference } from './modules/source-linker';
import { disposeComparisonPanel } from './ui/session-comparison';
import { disposeAnalysisPanel } from './ui/analysis-panel';
import { disposeInsightsPanel } from './ui/insights-panel';
import { disposeBugReportPanel } from './ui/bug-report-panel';
import { disposeTimelinePanel } from './ui/timeline-panel';
import { CrashlyticsCodeLensProvider } from './ui/crashlytics-codelens';
import { VitalsPanelProvider } from './ui/vitals-panel';
import { registerCommands } from './commands';
import { SessionDisplayOptions, defaultDisplayOptions } from './ui/session-display';
import { ViewerBroadcaster } from './ui/viewer-broadcaster';
import { PopOutPanel } from './ui/pop-out-panel';
import { wireSharedHandlers } from './ui/viewer-handler-wiring';
import { searchLogFilesConcurrent } from './modules/log-search';
import { BookmarkStore } from './modules/bookmark-store';
import { buildSessionListPayload } from './ui/viewer-provider-helpers';
import { buildScopeContext } from './modules/scope-context';
import { registerDebugLifecycle } from './extension-lifecycle';
import { AiWatcher } from './modules/ai-watcher';
import { formatAiEntry, filterAiEntries } from './modules/ai-line-formatter';

let sessionManager: SessionManagerImpl;
let inlineDecorations: InlineDecorationsProvider;
let viewerProvider: LogViewerProvider;
let historyProvider: SessionHistoryProvider;
let broadcaster: ViewerBroadcaster;
let popOutPanel: PopOutPanel;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar, outputChannel);

    sessionManager = new SessionManagerImpl(statusBar, outputChannel);

    // Inline code decorations.
    inlineDecorations = new InlineDecorationsProvider();
    context.subscriptions.push(inlineDecorations);

    // Sidebar viewer.
    // BUG FIX: `as string` made TypeScript treat the value as always a string,
    // so the `?? ''` fallback was unreachable. Use String() for safe conversion.
    const version = String(context.extension.packageJSON.version ?? '');
    viewerProvider = new LogViewerProvider(context.extensionUri, version, context);
    context.subscriptions.push(viewerProvider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );

    // Google Play Vitals sidebar panel (opt-in).
    const vitalsPanel = new VitalsPanelProvider();
    context.subscriptions.push(vitalsPanel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VitalsPanelProvider.viewType, vitalsPanel),
    );
    context.subscriptions.push(vscode.commands.registerCommand(
        'saropaLogCapture.refreshVitals', () => vitalsPanel.refresh(),
    ));

    // Crashlytics CodeLens — show crash indicators on affected source files.
    const crashCodeLens = new CrashlyticsCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, crashCodeLens));

    // Broadcaster + pop-out panel.
    broadcaster = new ViewerBroadcaster();
    popOutPanel = new PopOutPanel(context.extensionUri, version, context, broadcaster);
    broadcaster.addTarget(viewerProvider);
    broadcaster.addTarget(popOutPanel);
    context.subscriptions.push(popOutPanel);

    // Session history data provider (no tree view — Project Logs panel is the UI).
    historyProvider = new SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    historyProvider.onDidChangeTreeData(async () => {
        const items = await historyProvider.getAllChildren();
        broadcaster.sendSessionList(buildSessionListPayload(items, historyProvider.getActiveUri()));
    });

    // Bookmarks.
    const bookmarkStore = new BookmarkStore(context);
    context.subscriptions.push(bookmarkStore);
    bookmarkStore.onDidChange(() => { broadcaster.sendBookmarkList(bookmarkStore.getAll() as Record<string, unknown>); });

    // Deep links URI handler.
    context.subscriptions.push(
        vscode.window.registerUriHandler(createUriHandler()),
    );

    // Initialize config eagerly so it's available before first debug session.
    broadcaster.setPresets(loadPresets());
    const initCfg = getConfig();
    if (initCfg.highlightRules.length > 0) {
        broadcaster.setHighlightRules(initCfg.highlightRules);
    }
    broadcaster.setIconBarPosition(initCfg.iconBarPosition);
    broadcaster.setMinimapShowInfo(initCfg.minimapShowInfoMarkers);
    broadcaster.setMinimapWidth(initCfg.minimapWidth);

    // Live config changes for settings that can update mid-session.
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('saropaLogCapture.iconBarPosition')) {
            broadcaster.setIconBarPosition(getConfig().iconBarPosition);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowInfoMarkers')) {
            broadcaster.setMinimapShowInfo(getConfig().minimapShowInfoMarkers);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapWidth')) {
            broadcaster.setMinimapWidth(getConfig().minimapWidth);
        }
    }));

    // Session display options (strip datetime, normalize names).
    const displayKey = 'slc.sessionDisplayOptions';
    // Merge with defaults so newly-added fields are always present.
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
    // BUG FIX: was passing totalParts as both arguments, so the breadcrumb
    // always showed "Part N of N" after a split instead of the actual current part.
    sessionManager.addSplitListener((_newUri, partNumber, totalParts) => {
        broadcaster.setSplitInfo(partNumber, totalParts);
        const filename = sessionManager.getActiveFilename();
        if (filename) {
            broadcaster.setFilename(filename);
        }
        historyProvider.refresh();
    });
    // Wire shared handlers on both viewer targets.
    const onOpenBookmark = async (fileUri: string, lineIndex: number): Promise<void> => {
        await viewerProvider.loadFromFile(vscode.Uri.parse(fileUri));
        viewerProvider.scrollToLine(lineIndex + 1);
    };
    const handlerDeps = { sessionManager, broadcaster, historyProvider, bookmarkStore, onOpenBookmark };
    wireSharedHandlers(viewerProvider, handlerDeps);
    wireSharedHandlers(popOutPanel, handlerDeps);

    // Session navigation (prev/next session).
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

    // Sidebar-only handlers.
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

    // DAP tracker for all debug adapters.
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory(
            '*',
            new SaropaTrackerFactory(sessionManager),
        ),
    );

    // AI activity watcher (overlay — viewer-only, never written to .log files).
    const aiWatcher = new AiWatcher(outputChannel);
    context.subscriptions.push(aiWatcher);
    aiWatcher.onEntries((entries) => {
        const cfg = getConfig().aiActivity;
        for (const entry of filterAiEntries(entries, cfg)) {
            broadcaster.addLine(formatAiEntry(entry));
        }
    });

    // Debug session lifecycle.
    registerDebugLifecycle({ context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider, updateSessionNav, aiWatcher });

    // Commands.
    registerCommands({ context, sessionManager, viewerProvider, historyProvider, inlineDecorations, popOutPanel });

    // Source scope: track active editor and broadcast context to webview.
    const updateScopeContext = async (): Promise<void> => {
        const ctx = await buildScopeContext(vscode.window.activeTextEditor);
        broadcaster.setScopeContext(ctx);
    };
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => { updateScopeContext().catch(() => {}); }),
    );
    updateScopeContext().catch(() => {});

    // Prevent VS Code from restoring webview panels on startup.
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

    outputChannel.appendLine('Saropa Log Capture activated.');
}

export function deactivate(): void {
    sessionManager?.stopAll();
    popOutPanel?.dispose();
    disposeComparisonPanel();
    disposeAnalysisPanel();
    disposeInsightsPanel();
    disposeBugReportPanel();
    disposeTimelinePanel();
}

