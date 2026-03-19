/**
 * Commands for the Application / file logs (externalLogs) integration:
 * Add external log path, Open external logs for this session.
 */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { findSidecarUris } from './modules/context/context-loader';

const CONFIG_SECTION = 'saropaLogCapture';
const EXTERNAL_LOGS_PATHS_KEY = 'integrations.externalLogs.paths';

export function externalLogsCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.addExternalLogPath', async () => {
            const path = await vscode.window.showInputBox({
                prompt: 'Path to external log file (relative to workspace or absolute)',
                placeHolder: 'e.g. logs/app.log or logs/nginx/error.log',
            });
            if (path === undefined || path.trim() === '') { return; }
            const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
            const raw = cfg.get(EXTERNAL_LOGS_PATHS_KEY);
            const current = Array.isArray(raw) ? (raw as string[]) : [];
            if (current.includes(path.trim())) {
                void vscode.window.showInformationMessage('That path is already in the list.');
                return;
            }
            await cfg.update(EXTERNAL_LOGS_PATHS_KEY, [...current, path.trim()], vscode.ConfigurationTarget.Workspace);
            void vscode.window.showInformationMessage(
                'Added external log path. Enable Application / file logs in Configure integrations so it is tailed during debug sessions.',
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.openExternalLogsForSession', async () => {
            const logUri = viewerProvider.getCurrentFileUri();
            if (!logUri) {
                void vscode.window.showWarningMessage('No log file is currently open in the viewer.');
                return;
            }
            const sidecars = await findSidecarUris(logUri);
            const externalSidecars = sidecars.filter(
                (u) => u.fsPath.endsWith('.log') && !u.fsPath.endsWith('.terminal.log'),
            );
            if (externalSidecars.length === 0) {
                void vscode.window.showInformationMessage('This session has no external log sidecars.');
                return;
            }
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Opening external log sidecars',
                    cancellable: false,
                },
                async (progress) => {
                    const total = externalSidecars.length;
                    for (let i = 0; i < total; i += 1) {
                        const name = externalSidecars[i].fsPath.split(/[/\\]/).pop() ?? '';
                        progress.report({ message: `${i + 1}/${total}: ${name}` });
                        await vscode.window.showTextDocument(externalSidecars[i], { preview: false });
                    }
                },
            );
        }),
    ];
}
