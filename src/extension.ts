import * as vscode from 'vscode';
import { getLogDirectoryUri } from './config';
import { SaropaTrackerFactory } from './tracker';
import { SessionManagerImpl, handleDeleteCommand } from './session-manager';
import { StatusBar } from './ui/status-bar';
import { LogViewerProvider } from './ui/log-viewer-provider';

let sessionManager: SessionManagerImpl;
let viewerProvider: LogViewerProvider;

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
    sessionManager.addLineListener((line, isMarker) => {
        viewerProvider.addLine(line, isMarker);
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
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            await sessionManager.stopSession(session);
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
    );
}

export function deactivate(): void {
    sessionManager?.stopAll();
}
