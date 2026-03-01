import * as vscode from 'vscode';
import { getConfig, readTrackedFiles } from './config';
import type { SessionMetadataStore } from '../session/session-metadata';
import { getGlobalProjectIndexer } from '../project-indexer/project-indexer';

let hasNotifiedThisSession = false;

/**
 * Pure selection logic: given file stats (name, mtime) and max count, return the names
 * of the oldest files that should be trashed so the remaining count <= maxLogFiles.
 * Sorted oldest first. Exported for unit testing.
 */
export function selectFilesToTrash(
    fileStats: readonly { name: string; mtime: number }[],
    maxLogFiles: number,
): string[] {
    if (maxLogFiles <= 0 || fileStats.length <= maxLogFiles) { return []; }
    const sorted = [...fileStats].sort((a, b) => a.mtime - b.mtime);
    const toTrash = sorted.length - maxLogFiles;
    return sorted.slice(0, toTrash).map((f) => f.name);
}

function removeReportFromIndex(uri: vscode.Uri): void {
    if (!getConfig().projectIndex.enabled) { return; }
    const idx = getGlobalProjectIndexer();
    if (idx) { idx.removeEntry('reports', vscode.workspace.asRelativePath(uri).replace(/\\/g, '/')).catch(() => {}); }
}

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
    const results = await Promise.all(logFiles.map(async (name) => {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            const meta = await metaStore.loadMetadata(uri);
            if (meta.trashed) { return undefined; }
            const stat = await vscode.workspace.fs.stat(uri);
            return { name, mtime: stat.mtime };
        } catch { return undefined; }
    }));
    const fileStats = results.filter((r): r is { name: string; mtime: number } => r !== undefined);
    const namesToTrash = selectFilesToTrash(fileStats, maxLogFiles);
    if (namesToTrash.length === 0) {
        return 0;
    }

    let trashed = 0;
    for (const name of namesToTrash) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            await metaStore.setTrashed(uri, true);
            removeReportFromIndex(uri);
            trashed++;
        } catch {
            // File may be locked — skip it.
        }
    }

    if (trashed > 0 && !hasNotifiedThisSession) {
        hasNotifiedThisSession = true;
        vscode.window.showInformationMessage(
            vscode.l10n.t('msg.fileRetentionMoved', String(trashed), String(maxLogFiles)),
        );
    }

    return trashed;
}
