import * as vscode from 'vscode';
import { getConfig } from './modules/config';
import { SaropaTrackerFactory } from './modules/tracker';
import { SessionManagerImpl } from './modules/session-manager';
import { resolveSourceUri } from './modules/source-resolver';
import { showSearchQuickPick } from './modules/log-search-ui';
import { openLogAtLine } from './modules/log-search';
import { StatusBar } from './ui/status-bar';
import { LogViewerProvider } from './ui/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session-history-provider';
import { createUriHandler } from './modules/deep-links';
import { loadPresets, promptSavePreset } from './modules/filter-presets';
import { InlineDecorationsProvider } from './ui/inline-decorations';
import { extractSourceReference } from './modules/source-linker';
import { disposeComparisonPanel } from './ui/session-comparison';
import { registerCommands } from './commands';

let sessionManager: SessionManagerImpl;
let inlineDecorations: InlineDecorationsProvider;
let viewerProvider: LogViewerProvider;
let historyProvider: SessionHistoryProvider;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar, outputChannel);

    sessionManager = new SessionManagerImpl(statusBar, outputChannel);

    // Inline code decorations.
    inlineDecorations = new InlineDecorationsProvider();
    context.subscriptions.push(inlineDecorations);

    // Sidebar viewer.
    viewerProvider = new LogViewerProvider(context.extensionUri);
    context.subscriptions.push(viewerProvider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider),
    );
    // Session history tree.
    historyProvider = new SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('saropaLogCapture.sessionHistory', historyProvider),
    );

    // Deep links URI handler.
    context.subscriptions.push(
        vscode.window.registerUriHandler(createUriHandler()),
    );

    // Initialize config eagerly so it's available before first debug session.
    viewerProvider.setPresets(loadPresets());
    const initCfg = getConfig();
    if (initCfg.highlightRules.length > 0) {
        viewerProvider.setHighlightRules(initCfg.highlightRules);
    }

    sessionManager.addLineListener((data) => {
        viewerProvider.addLine(data);
        if (data.watchHits && data.watchHits.length > 0) {
            viewerProvider.updateWatchCounts(sessionManager.getWatcher().getCounts());
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
    sessionManager.addSplitListener((_newUri, _partNumber, totalParts) => {
        viewerProvider.setSplitInfo(totalParts, totalParts);
        const filename = sessionManager.getActiveFilename();
        if (filename) {
            viewerProvider.setFilename(filename);
        }
        historyProvider.refresh();
    });
    viewerProvider.setMarkerHandler(() => {
        sessionManager.insertMarker();
    });
    viewerProvider.setLinkClickHandler((filePath, line, col, split) => {
        openSourceFile(filePath, line, col, split);
    });
    viewerProvider.setTogglePauseHandler(() => {
        const paused = sessionManager.togglePause();
        if (paused !== undefined) {
            viewerProvider.setPaused(paused);
        }
    });
    viewerProvider.setExclusionAddedHandler(async (pattern) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const current = cfg.get<string[]>('exclusions', []);
        if (!current.includes(pattern)) {
            await cfg.update('exclusions', [...current, pattern], vscode.ConfigurationTarget.Workspace);
        }
    });
    viewerProvider.setAnnotationPromptHandler(async (lineIndex, current) => {
        const text = await vscode.window.showInputBox({
            prompt: `Annotate line ${lineIndex + 1}`,
            value: current,
        });
        if (text === undefined) {
            return;
        }
        viewerProvider.setAnnotation(lineIndex, text);
        const logSession = sessionManager.getActiveSession();
        if (logSession) {
            const store = historyProvider.getMetaStore();
            await store.addAnnotation(logSession.fileUri, {
                lineIndex,
                text,
                timestamp: new Date().toISOString(),
            });
        }
    });
    viewerProvider.setSavePresetRequestHandler(async (filters) => {
        const preset = await promptSavePreset(filters as {
            categories?: string[];
            searchPattern?: string;
            exclusionsEnabled?: boolean;
        });
        if (preset) {
            viewerProvider.setPresets(loadPresets());
        }
    });
    viewerProvider.setSearchCodebaseHandler(async (text) => {
        await vscode.commands.executeCommand('workbench.action.findInFiles', { query: text });
    });
    viewerProvider.setSearchSessionsHandler(async (text) => {
        const match = await showSearchQuickPick(text);
        if (match) {
            await openLogAtLine(match);
        }
    });
    viewerProvider.setAddToWatchHandler(async (text) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const current = cfg.get<{ pattern: string; alertType?: string }[]>('watchPatterns', []);
        if (current.some(p => p.pattern === text)) {
            vscode.window.showInformationMessage(`"${text}" is already in watch list.`);
            return;
        }
        await cfg.update('watchPatterns', [...current, { pattern: text }], vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Added "${text}" to watch list.`);
    });

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
            viewerProvider.setPaused(false);
            await sessionManager.startSession(session, context);
            const activeSession = sessionManager.getActiveSession();
            const filename = sessionManager.getActiveFilename();
            if (filename) {
                viewerProvider.setFilename(filename);
            }
            // Track session state for edit line functionality
            viewerProvider.setSessionActive(true);
            if (activeSession?.fileUri) {
                viewerProvider.setCurrentFile(activeSession.fileUri);
            }
            viewerProvider.setSplitInfo(1, 1);
            const cfg = getConfig();
            if (cfg.exclusions.length > 0) {
                viewerProvider.setExclusions(cfg.exclusions);
            }
            if (cfg.showElapsedTime) {
                viewerProvider.setShowElapsed(true);
            }
            if (cfg.showDecorations) {
                viewerProvider.setShowDecorations(true);
            }
            viewerProvider.setErrorClassificationSettings(
                cfg.suppressTransientErrors ?? false,
                cfg.breakOnCritical ?? false
            );
            if (cfg.highlightRules.length > 0) {
                viewerProvider.setHighlightRules(cfg.highlightRules);
            }
            viewerProvider.setContextLines(cfg.filterContextLines);
            viewerProvider.setContextViewLines(cfg.contextViewLines);
            viewerProvider.setPresets(loadPresets());
            historyProvider.setActiveUri(activeSession?.fileUri);
            historyProvider.refresh();
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            await sessionManager.stopSession(session);
            viewerProvider.setSessionActive(false);
            historyProvider.setActiveUri(undefined);
            historyProvider.refresh();
            inlineDecorations.clearAll();
        }),
    );

    // Commands.
    registerCommands({ context, sessionManager, viewerProvider, historyProvider, inlineDecorations });

    outputChannel.appendLine('Saropa Log Capture activated.');
}

export function deactivate(): void {
    sessionManager?.stopAll();
    disposeComparisonPanel();
}

/** Open a source file at a specific line, optionally in a split editor. */
async function openSourceFile(filePath: string, line: number, col: number, split: boolean): Promise<void> {
    const uri = resolveSourceUri(filePath);
    if (!uri) {
        return;
    }
    const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
    const viewColumn = split ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn });
    } catch {
        // File may not exist on disk — ignore silently.
    }
}
