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
import { registerCommands } from './commands';
import { SessionDisplayOptions, defaultDisplayOptions } from './ui/session-display';
import { ViewerBroadcaster } from './ui/viewer-broadcaster';
import { PopOutPanel } from './ui/pop-out-panel';
import { wireSharedHandlers } from './ui/viewer-handler-wiring';
import { searchLogFilesConcurrent } from './modules/log-search';
import { BookmarkStore } from './modules/bookmark-store';

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
        vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider),
    );

    // Broadcaster + pop-out panel.
    broadcaster = new ViewerBroadcaster();
    popOutPanel = new PopOutPanel(context.extensionUri, version, context, broadcaster);
    broadcaster.addTarget(viewerProvider);
    broadcaster.addTarget(popOutPanel);
    context.subscriptions.push(popOutPanel);

    // Session history tree.
    historyProvider = new SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    const historyTreeView = vscode.window.createTreeView('saropaLogCapture.sessionHistory', {
        treeDataProvider: historyProvider,
    });
    context.subscriptions.push(historyTreeView);

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

    // Sidebar-only handlers.
    viewerProvider.setOpenSessionFromPanelHandler(async (uriString) => {
        if (!uriString) { return; }
        await viewerProvider.loadFromFile(vscode.Uri.parse(uriString));
    });
    viewerProvider.setPopOutHandler(() => { void popOutPanel.open(); });
    viewerProvider.setRevealLogFileHandler(async (uriString) => {
        const uri = vscode.Uri.parse(uriString);
        const item = await historyProvider.findByUri(uri);
        if (item) {
            await historyTreeView.reveal(item, { select: true, focus: true });
        } else {
            await vscode.commands.executeCommand('saropaLogCapture.sessionHistory.focus');
        }
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
                cfg.breakOnCritical ?? false
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
        }),
    );

    // Commands.
    registerCommands({ context, sessionManager, viewerProvider, historyProvider, inlineDecorations, popOutPanel });

    outputChannel.appendLine('Saropa Log Capture activated.');
}

export function deactivate(): void {
    sessionManager?.stopAll();
    popOutPanel?.dispose();
    disposeComparisonPanel();
}

