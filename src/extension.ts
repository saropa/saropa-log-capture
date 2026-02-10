import * as os from 'os';
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
import { CrashlyticsPanelProvider } from './ui/crashlytics-panel';
import { CrashlyticsCodeLensProvider } from './ui/crashlytics-codelens';
import { RecurringErrorsPanelProvider } from './ui/recurring-errors-panel';
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

    // Crashlytics sidebar panel.
    const crashlyticsPanel = new CrashlyticsPanelProvider();
    context.subscriptions.push(crashlyticsPanel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(CrashlyticsPanelProvider.viewType, crashlyticsPanel),
    );

    // Recurring Errors sidebar panel.
    const recurringErrorsPanel = new RecurringErrorsPanelProvider();
    context.subscriptions.push(recurringErrorsPanel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(RecurringErrorsPanelProvider.viewType, recurringErrorsPanel),
    );
    context.subscriptions.push(vscode.commands.registerCommand(
        'saropaLogCapture.refreshRecurringErrors', () => recurringErrorsPanel.refresh(),
    ));

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

    // Live config changes for icon bar position.
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('saropaLogCapture.iconBarPosition')) {
            broadcaster.setIconBarPosition(getConfig().iconBarPosition);
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

    // Debug session lifecycle.
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(async (session) => {
            broadcaster.setPaused(false);
            await sessionManager.startSession(session, context);
            const activeSession = sessionManager.getActiveSession();
            const filename = sessionManager.getActiveFilename();
            if (filename) {
                broadcaster.setFilename(filename);
            }
            broadcaster.setSessionActive(true);
            viewerProvider.setSessionNavInfo(false, false, 0, 0);
            if (activeSession?.fileUri) {
                broadcaster.setCurrentFile(activeSession.fileUri);
            }
            broadcaster.setSplitInfo(1, 1);
            broadcaster.setSessionInfo({
                'Date': new Date().toISOString(),
                'Project': session.workspaceFolder?.name ?? 'Unknown',
                'Debug Adapter': session.type,
                'launch.json': session.configuration.name,
                'VS Code': vscode.version,
                'Extension': `saropa-log-capture v${context.extension.packageJSON.version ?? '0.0.0'}`,
                'OS': `${os.type()} ${os.release()} (${os.arch()})`,
            });
            const cfg = getConfig();
            if (cfg.exclusions.length > 0) {
                broadcaster.setExclusions(cfg.exclusions);
            }
            if (cfg.showElapsedTime) {
                broadcaster.setShowElapsed(true);
            }
            if (cfg.showDecorations) {
                broadcaster.setShowDecorations(true);
            }
            broadcaster.setErrorClassificationSettings(
                cfg.suppressTransientErrors ?? false,
                cfg.breakOnCritical ?? false,
                cfg.levelDetection ?? "strict",
                cfg.deemphasizeFrameworkLevels ?? false
            );
            if (cfg.highlightRules.length > 0) {
                broadcaster.setHighlightRules(cfg.highlightRules);
            }
            broadcaster.setContextLines(cfg.filterContextLines);
            broadcaster.setContextViewLines(cfg.contextViewLines);
            broadcaster.setPresets(loadPresets());
            historyProvider.setActiveUri(activeSession?.fileUri);
            historyProvider.refresh();
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            await sessionManager.stopSession(session);
            broadcaster.setSessionActive(false);
            historyProvider.setActiveUri(undefined);
            historyProvider.refresh();
            inlineDecorations.clearAll();
            updateSessionNav().catch(() => {});
        }),
    );

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

