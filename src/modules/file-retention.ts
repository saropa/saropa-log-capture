import * as vscode from 'vscode';
import { getConfig, readTrackedFiles } from './config';
import type { SessionMetadataStore } from './session-metadata';

let hasNotifiedThisSession = false;

/**
 * Enforce the maxLogFiles limit. Trashes oldest tracked files by mtime
 * until file count <= maxLogFiles. Includes subdirectories when enabled.
 * @returns The number of files trashed.
 */
export async function enforceFileRetention(
    logDirUri: vscode.Uri,
    maxLogFiles: number,
    metaStore: SessionMetadataStore,
): Promise<number> {
    if (maxLogFiles <= 0) {
        return 0;
    }

    const { fileTypes, includeSubfolders } = getConfig();
    const logFiles = await readTrackedFiles(logDirUri, fileTypes, includeSubfolders);

    if (logFiles.length <= maxLogFiles) {
        return 0;
    }

    // Only count non-trashed files toward the limit.
    const fileStats: { name: string; mtime: number }[] = [];
    for (const name of logFiles) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            const meta = await metaStore.loadMetadata(uri);
            if (meta.trashed) { continue; }
            const stat = await vscode.workspace.fs.stat(uri);
            fileStats.push({ name, mtime: stat.mtime });
        } catch {
            // Skip files we can't stat.
        }
    }

    // Sort oldest first.
    fileStats.sort((a, b) => a.mtime - b.mtime);

    const toTrash = fileStats.length - maxLogFiles;
    if (toTrash <= 0) {
        return 0;
    }

    let trashed = 0;
    for (let i = 0; i < toTrash; i++) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, fileStats[i].name);
            await metaStore.setTrashed(uri, true);
            trashed++;
        } catch {
            // File may be locked — skip it.
        }
    }

    if (trashed > 0 && !hasNotifiedThisSession) {
        hasNotifiedThisSession = true;
        vscode.window.showInformationMessage(
            `Saropa Log Capture: Moved ${trashed} old file(s) to trash (maxLogFiles: ${maxLogFiles}).`
        );
    }

    return trashed;
}
