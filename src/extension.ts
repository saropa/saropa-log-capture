import * as os from 'os';
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
import { TreeItem, isSplitGroup } from './ui/session-history-grouping';

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
    // BUG FIX: `as string` made TypeScript treat the value as always a string,
    // so the `?? ''` fallback was unreachable. Use String() for safe conversion.
    const version = String(context.extension.packageJSON.version ?? '');
    viewerProvider = new LogViewerProvider(context.extensionUri, version, context);
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
    // BUG FIX: was passing totalParts as both arguments, so the breadcrumb
    // always showed "Part N of N" after a split instead of the actual current part.
    sessionManager.addSplitListener((_newUri, partNumber, totalParts) => {
        viewerProvider.setSplitInfo(partNumber, totalParts);
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
    viewerProvider.setExclusionRemovedHandler(async (pattern) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const current = cfg.get<string[]>('exclusions', []);
        const updated = current.filter(p => p !== pattern);
        if (updated.length !== current.length) {
            await cfg.update('exclusions', updated, vscode.ConfigurationTarget.Workspace);
            viewerProvider.setExclusions(updated);
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
    viewerProvider.setSessionListHandler(async () => {
        const items = await historyProvider.getChildren();
        const sessions = buildSessionListPayload(items, historyProvider);
        viewerProvider.sendSessionList(sessions);
    });
    viewerProvider.setOpenSessionFromPanelHandler(async (uriString) => {
        if (!uriString) { return; }
        const uri = vscode.Uri.parse(uriString);
        await viewerProvider.loadFromFile(uri);
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
            viewerProvider.setSessionInfo({
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

/** Convert tree items to a flat session list for the webview panel. */
function buildSessionListPayload(
    items: readonly TreeItem[],
    provider: SessionHistoryProvider,
): Record<string, unknown>[] {
    const activeUri = provider.getActiveUri();
    return items.flatMap(item => {
        if (isSplitGroup(item)) {
            return item.parts.map(p => ({
                filename: p.filename,
                displayName: p.displayName ?? p.filename,
                adapter: p.adapter,
                size: p.size,
                date: p.date,
                hasTimestamps: p.hasTimestamps ?? false,
                isActive: activeUri?.toString() === p.uri.toString(),
                uriString: p.uri.toString(),
            }));
        }
        return [{
            filename: item.filename,
            displayName: item.displayName ?? item.filename,
            adapter: item.adapter,
            size: item.size,
            date: item.date,
            hasTimestamps: item.hasTimestamps ?? false,
            isActive: activeUri?.toString() === item.uri.toString(),
            uriString: item.uri.toString(),
        }];
    });
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
