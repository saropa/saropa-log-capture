import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './modules/config';
import { SaropaTrackerFactory } from './modules/tracker';
import { SessionManagerImpl } from './modules/session-manager';
import { handleDeleteCommand } from './modules/delete-command';
import { resolveSourceUri } from './modules/source-resolver';
import { showSearchQuickPick, openLogAtLine } from './modules/log-search';
import { StatusBar } from './ui/status-bar';
import { LogViewerProvider } from './ui/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session-history-provider';
import { exportToHtml } from './modules/html-export';
import { exportToInteractiveHtml } from './modules/html-export-interactive';
import { createUriHandler, copyDeepLinkToClipboard } from './modules/deep-links';

let sessionManager: SessionManagerImpl;
let viewerProvider: LogViewerProvider;
let historyProvider: SessionHistoryProvider;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar, outputChannel);

    sessionManager = new SessionManagerImpl(statusBar, outputChannel);

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

    sessionManager.addLineListener((data) => {
        viewerProvider.addLine(data);
        if (data.watchHits && data.watchHits.length > 0) {
            viewerProvider.updateWatchCounts(sessionManager.getWatcher().getCounts());
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
            // Initialize split info (part 1 of 1)
            viewerProvider.setSplitInfo(1, 1);
            const cfg = getConfig();
            if (cfg.exclusions.length > 0) {
                viewerProvider.setExclusions(cfg.exclusions);
            }
            if (cfg.showElapsedTime) {
                viewerProvider.setShowElapsed(true);
            }
            historyProvider.setActiveUri(activeSession?.fileUri);
            historyProvider.refresh();
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            await sessionManager.stopSession(session);
            historyProvider.setActiveUri(undefined);
            historyProvider.refresh();
        }),
    );

    // Commands.
    registerCommands(context);

    outputChannel.appendLine('Saropa Log Capture activated.');
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !sessionManager.hasSession(active.id)) {
                sessionManager.startSession(active, context);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                await sessionManager.stopSession(active);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const paused = sessionManager.togglePause();
            if (paused !== undefined) {
                viewerProvider.setPaused(paused);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const logSession = sessionManager.getActiveSession();
            if (logSession) {
                await vscode.window.showTextDocument(logSession.fileUri);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (folder) {
                const logDir = getLogDirectoryUri(folder);
                await vscode.commands.executeCommand('revealFileInOS', logDir);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            sessionManager.clearActiveSession();
        }),

        vscode.commands.registerCommand('saropaLogCapture.delete', async () => {
            await handleDeleteCommand();
        }),

        vscode.commands.registerCommand('saropaLogCapture.insertMarker', async () => {
            const text = await vscode.window.showInputBox({
                prompt: 'Marker text (leave empty for timestamp only)',
                placeHolder: 'e.g. before refactor, test attempt 2',
            });
            if (text === undefined) {
                return; // User pressed Escape.
            }
            sessionManager.insertMarker(text || undefined);
        }),

        vscode.commands.registerCommand('saropaLogCapture.splitNow', async () => {
            const session = sessionManager.getActiveSession();
            if (!session) {
                vscode.window.showWarningMessage('No active debug session to split.');
                return;
            }
            await session.splitNow();
            historyProvider.refresh();
            vscode.window.showInformationMessage(`Log file split. Now on part ${session.partNumber + 1}.`);
        }),

        vscode.commands.registerCommand('saropaLogCapture.refreshHistory', () => {
            historyProvider.refresh();
        }),

        vscode.commands.registerCommand('saropaLogCapture.openSession', async (item: { uri: vscode.Uri }) => {
            if (item?.uri) {
                await vscode.window.showTextDocument(item.uri);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.deleteSession', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) {
                return;
            }
            const answer = await vscode.window.showWarningMessage(
                `Delete ${item.filename}?`, { modal: true }, 'Delete',
            );
            if (answer === 'Delete') {
                await vscode.workspace.fs.delete(item.uri);
                historyProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportHtml', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const htmlUri = await exportToHtml(item.uri);
            await vscode.env.openExternal(htmlUri);
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportHtmlInteractive', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const htmlUri = await exportToInteractiveHtml(item.uri);
            await vscode.env.openExternal(htmlUri);
        }),

        vscode.commands.registerCommand('saropaLogCapture.renameSession', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) {
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: 'Enter new name for this session (also renames file)',
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_\d{2}-\d{2}_/, ''),
            });
            if (name === undefined || name.trim() === '') {
                return;
            }
            // Rename the file on disk
            const metaStore = historyProvider.getMetaStore();
            const newUri = await metaStore.renameLogFile(item.uri, name.trim());
            // Update display name in metadata (uses new URI if renamed)
            await metaStore.setDisplayName(newUri, name.trim());
            historyProvider.refresh();
        }),

        vscode.commands.registerCommand('saropaLogCapture.tagSession', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const meta = await historyProvider.getMetaStore().loadMetadata(item.uri);
            const current = (meta.tags ?? []).join(', ');
            const input = await vscode.window.showInputBox({
                prompt: 'Enter tags (comma-separated)',
                value: current,
            });
            if (input === undefined) {
                return;
            }
            const tags = input.split(',').map(t => t.trim()).filter(t => t.length > 0);
            await historyProvider.getMetaStore().setTags(item.uri, tags);
            historyProvider.refresh();
        }),

        vscode.commands.registerCommand('saropaLogCapture.searchLogs', async () => {
            const match = await showSearchQuickPick();
            if (match) {
                await openLogAtLine(match);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.copyDeepLink', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.filename) {
                return;
            }
            await copyDeepLinkToClipboard(item.filename);
        }),
    );
}

export function deactivate(): void {
    sessionManager?.stopAll();
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

