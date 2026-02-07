import * as vscode from 'vscode';
import { getConfig, readTrackedFiles } from './config';

let hasNotifiedThisSession = false;

/**
 * Enforce the maxLogFiles limit. Deletes oldest tracked files by mtime
 * until file count <= maxLogFiles. Includes subdirectories when enabled.
 * @returns The number of files deleted.
 */
export async function enforceFileRetention(
    logDirUri: vscode.Uri,
    maxLogFiles: number
): Promise<number> {
    if (maxLogFiles <= 0) {
        return 0;
    }

    const { fileTypes, includeSubfolders } = getConfig();
    const logFiles = await readTrackedFiles(logDirUri, fileTypes, includeSubfolders);

    if (logFiles.length <= maxLogFiles) {
        return 0;
    }

    const fileStats: { name: string; mtime: number }[] = [];
    for (const name of logFiles) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            const stat = await vscode.workspace.fs.stat(uri);
            fileStats.push({ name, mtime: stat.mtime });
        } catch {
            // Skip files we can't stat.
        }
    }

    // Sort oldest first.
    fileStats.sort((a, b) => a.mtime - b.mtime);

    const toDelete = fileStats.length - maxLogFiles;
    if (toDelete <= 0) {
        return 0;
    }

    let deleted = 0;
    for (let i = 0; i < toDelete; i++) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, fileStats[i].name);
            await vscode.workspace.fs.delete(uri);
            deleted++;
        } catch {
            // File may be locked — skip it.
        }
    }

    if (deleted > 0 && !hasNotifiedThisSession) {
        hasNotifiedThisSession = true;
        vscode.window.showInformationMessage(
            `Saropa Log Capture: Removed ${deleted} old file(s) (maxLogFiles: ${maxLogFiles}).`
        );
    }

    return deleted;
}
