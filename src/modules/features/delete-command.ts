import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from '../config/config';

/** Show a quick pick to delete session files from the reports directory. */
export async function handleDeleteCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }

    const logDirUri = getLogDirectoryUri(folder);

    const { fileTypes, includeSubfolders } = getConfig();
    const logFiles = (await readTrackedFiles(logDirUri, fileTypes, includeSubfolders))
        .sort()
        .reverse();

    if (logFiles.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('msg.noSessionFiles'));
        return;
    }

    const selected = await vscode.window.showQuickPick(logFiles, {
        placeHolder: vscode.l10n.t('prompt.selectSessionsToDelete'),
        canPickMany: true,
    });

    if (selected && selected.length > 0) {
        for (const file of selected) {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(logDirUri, file));
        }
        vscode.window.showInformationMessage(vscode.l10n.t('msg.deletedSessionFiles', String(selected.length)));
    }
}
