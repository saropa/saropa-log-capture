import * as vscode from 'vscode';
import * as os from 'os';
import { getConfig, getLogDirectoryUri } from './config';
import { SaropaTrackerFactory, SessionManager, DapOutputBody } from './tracker';
import { LogSession, SessionContext } from './log-session';
import { enforceFileRetention } from './file-retention';
import { checkGitignore } from './gitignore-checker';
import { StatusBar } from './ui/status-bar';

const activeSessions = new Map<string, LogSession>();
let statusBar: StatusBar;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    statusBar = new StatusBar();
    context.subscriptions.push(statusBar, outputChannel);

    const sessionManager: SessionManager = {
        onOutputEvent(sessionId: string, body: DapOutputBody): void {
            const session = activeSessions.get(sessionId);
            if (!session) {
                return;
            }

            const config = getConfig();
            if (!config.enabled) {
                return;
            }

            const category = body.category ?? 'console';
            if (!config.categories.includes(category)) {
                return;
            }

            const text = body.output.replace(/\r?\n$/, '');
            if (text.length === 0) {
                return;
            }

            session.appendLine(text, category, new Date());
        },
    };

    // Register tracker factory for all debug adapters.
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory(
            '*',
            new SaropaTrackerFactory(sessionManager)
        )
    );

    // Debug session lifecycle.
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(async (session) => {
            await handleSessionStart(session, context);
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            await handleSessionEnd(session);
        })
    );

    // Commands.
    context.subscriptions.push(
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !activeSessions.has(active.id)) {
                handleSessionStart(active, context);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                await handleSessionEnd(active);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const active = vscode.debug.activeDebugSession;
            if (!active) {
                return;
            }
            const logSession = activeSessions.get(active.id);
            if (!logSession) {
                return;
            }
            if (logSession.state === 'recording') {
                logSession.pause();
                statusBar.setPaused(true);
            } else if (logSession.state === 'paused') {
                logSession.resume();
                statusBar.setPaused(false);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                const logSession = activeSessions.get(active.id);
                if (logSession) {
                    await vscode.window.showTextDocument(logSession.fileUri);
                }
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = getWorkspaceFolder();
            if (folder) {
                const logDir = getLogDirectoryUri(folder);
                await vscode.commands.executeCommand('revealFileInOS', logDir);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                const logSession = activeSessions.get(active.id);
                if (logSession) {
                    logSession.clear();
                    statusBar.updateLineCount(0);
                }
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.delete', async () => {
            await handleDeleteCommand();
        })
    );

    outputChannel.appendLine('Saropa Log Capture activated.');
}

async function handleSessionStart(
    session: vscode.DebugSession,
    context: vscode.ExtensionContext
): Promise<void> {
    const config = getConfig();
    if (!config.enabled) {
        return;
    }

    // Skip child sessions if parent already has a log session.
    if (session.parentSession && activeSessions.has(session.parentSession.id)) {
        return;
    }

    const workspaceFolder = session.workspaceFolder ?? getWorkspaceFolder();
    if (!workspaceFolder) {
        outputChannel.appendLine('No workspace folder found. Skipping capture.');
        return;
    }

    // Gitignore check (non-blocking).
    checkGitignore(context, workspaceFolder, config.logDirectory).catch((err) => {
        outputChannel.appendLine(`Gitignore check failed: ${err}`);
    });

    // File retention (non-blocking).
    const logDirUri = getLogDirectoryUri(workspaceFolder);
    enforceFileRetention(logDirUri, config.maxLogFiles).catch((err) => {
        outputChannel.appendLine(`File retention failed: ${err}`);
    });

    const sessionContext: SessionContext = {
        date: new Date(),
        projectName: workspaceFolder.name,
        debugAdapterType: session.type,
        configurationName: session.configuration.name,
        configuration: session.configuration,
        vscodeVersion: vscode.version,
        extensionVersion: context.extension.packageJSON.version ?? '0.0.0',
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        workspaceFolder,
    };

    const logSession = new LogSession(sessionContext, config, (count) => {
        statusBar.updateLineCount(count);
    });

    try {
        await logSession.start();
        activeSessions.set(session.id, logSession);
        statusBar.show();
        outputChannel.appendLine(`Session started: ${logSession.fileUri.fsPath}`);
    } catch (err) {
        outputChannel.appendLine(`Failed to start log session: ${err}`);
    }
}

async function handleSessionEnd(session: vscode.DebugSession): Promise<void> {
    const logSession = activeSessions.get(session.id);
    if (!logSession) {
        return;
    }

    try {
        await logSession.stop();
        outputChannel.appendLine(`Session stopped: ${logSession.fileUri.fsPath}`);
    } catch (err) {
        outputChannel.appendLine(`Error stopping log session: ${err}`);
    }

    activeSessions.delete(session.id);

    if (activeSessions.size === 0) {
        statusBar.hide();
    }

    const config = getConfig();
    if (config.autoOpen) {
        await vscode.window.showTextDocument(logSession.fileUri);
    }
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

async function handleDeleteCommand(): Promise<void> {
    const folder = getWorkspaceFolder();
    if (!folder) {
        return;
    }

    const logDirUri = getLogDirectoryUri(folder);

    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDirUri);
    } catch {
        vscode.window.showInformationMessage('No log files found.');
        return;
    }

    const logFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'))
        .map(([name]) => name)
        .sort()
        .reverse();

    if (logFiles.length === 0) {
        vscode.window.showInformationMessage('No log files found.');
        return;
    }

    const selected = await vscode.window.showQuickPick(logFiles, {
        placeHolder: 'Select log file(s) to delete',
        canPickMany: true,
    });

    if (selected && selected.length > 0) {
        for (const file of selected) {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(logDirUri, file));
        }
        vscode.window.showInformationMessage(`Deleted ${selected.length} log file(s).`);
    }
}

export function deactivate() {
    for (const [, session] of activeSessions) {
        session.stop().catch(() => {});
    }
    activeSessions.clear();
}
