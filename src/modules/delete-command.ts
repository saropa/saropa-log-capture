import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, isTrackedFile } from './config';

/** Show a quick pick to delete session files from the reports directory. */
export async function handleDeleteCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }

    const logDirUri = getLogDirectoryUri(folder);

    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDirUri);
    } catch {
        vscode.window.showInformationMessage('No session files found.');
        return;
    }

    const { fileTypes } = getConfig();
    const logFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && isTrackedFile(name, fileTypes))
        .map(([name]) => name)
        .sort()
        .reverse();

    if (logFiles.length === 0) {
        vscode.window.showInformationMessage('No session files found.');
        return;
    }

    const selected = await vscode.window.showQuickPick(logFiles, {
        placeHolder: 'Select session file(s) to delete',
        canPickMany: true,
    });

    if (selected && selected.length > 0) {
        for (const file of selected) {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(logDirUri, file));
        }
        vscode.window.showInformationMessage(`Deleted ${selected.length} session file(s).`);
    }
}
