/** Session comparison command registrations. */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from './modules/config';
import { getComparisonPanel } from './ui/session-comparison';

/** URI of session marked for comparison (first selection). */
let comparisonMarkUri: vscode.Uri | undefined;

/** Register session comparison commands. */
export function comparisonCommands(extensionUri: vscode.Uri): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.markForComparison',
          (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            comparisonMarkUri = item.uri;
            vscode.window.showInformationMessage(
                `Marked "${item.filename}" for comparison. Select another session to compare.`,
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareWithMarked',
          async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            if (!comparisonMarkUri) {
                vscode.window.showWarningMessage(
                    'No session marked. Right-click a session and "Mark for Comparison" first.',
                );
                return;
            }
            if (comparisonMarkUri.fsPath === item.uri.fsPath) {
                vscode.window.showWarningMessage('Cannot compare a session with itself.');
                return;
            }
            const panel = getComparisonPanel(extensionUri);
            await panel.compare(comparisonMarkUri, item.uri);
            comparisonMarkUri = undefined;
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareSessions', async () => {
            const sessions = await pickTwoSessions();
            if (sessions) {
                const panel = getComparisonPanel(extensionUri);
                await panel.compare(sessions[0], sessions[1]);
            }
        }),
    ];
}

/** Show Quick Pick to select two sessions for comparison. */
async function pickTwoSessions(): Promise<[vscode.Uri, vscode.Uri] | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    const { fileTypes, includeSubfolders } = getConfig();
    const tracked = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
    const files = tracked
        .map(rel => ({ label: rel, uri: vscode.Uri.joinPath(logDir, rel) }))
        .sort((a, b) => b.label.localeCompare(a.label));
    if (files.length < 2) {
        vscode.window.showWarningMessage('Need at least 2 sessions to compare.');
        return undefined;
    }
    const first = await vscode.window.showQuickPick(files, {
        placeHolder: 'Select FIRST session to compare', title: 'Compare Sessions (1/2)',
    });
    if (!first) { return undefined; }
    const second = await vscode.window.showQuickPick(
        files.filter(f => f.uri.fsPath !== first.uri.fsPath),
        { placeHolder: 'Select SECOND session to compare', title: 'Compare Sessions (2/2)' },
    );
    return second ? [first.uri, second.uri] : undefined;
}
