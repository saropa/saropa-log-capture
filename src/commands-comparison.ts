/** Session comparison command registrations. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from './modules/config/config';
import { getComparisonPanel } from './ui/session/session-comparison';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';

/** URI of session marked for comparison (first selection). */
let comparisonMarkUri: vscode.Uri | undefined;

/** Register session comparison commands. */
export function comparisonCommands(extensionUri: vscode.Uri, broadcaster: ViewerBroadcaster): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.markForComparison',
          (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            comparisonMarkUri = item.uri;
            vscode.window.showInformationMessage(
                t('msg.markedForComparison', item.filename),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareWithMarked',
          async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            if (!comparisonMarkUri) {
                vscode.window.showWarningMessage(
                    t('msg.noSessionMarked'),
                );
                return;
            }
            if (comparisonMarkUri.fsPath === item.uri.fsPath) {
                vscode.window.showWarningMessage(t('msg.cannotCompareWithSelf'));
                return;
            }
            const panel = getComparisonPanel(extensionUri);
            await panel.compare(comparisonMarkUri, item.uri);
            comparisonMarkUri = undefined;
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareSessions', async () => {
            const sessions = await pickTwoSessions();
            if (sessions) {
                const panel = getComparisonPanel(extensionUri, broadcaster);
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
        vscode.window.showWarningMessage(t('msg.needTwoSessions'));
        return undefined;
    }
    const first = await vscode.window.showQuickPick(files, {
        placeHolder: t('prompt.selectFirstSession'),
        title: t('title.compareSessions1'),
    });
    if (!first) { return undefined; }
    const second = await vscode.window.showQuickPick(
        files.filter(f => f.uri.fsPath !== first.uri.fsPath),
        {
            placeHolder: t('prompt.selectSecondSession'),
            title: t('title.compareSessions2'),
        },
    );
    return second ? [first.uri, second.uri] : undefined;
}
