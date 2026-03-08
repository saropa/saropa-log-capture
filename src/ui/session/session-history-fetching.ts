/**
 * Fetch, cache, and migration logic for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from '../../modules/config/config';
import { SessionMetadataStore, migrateSidecarsInDirectory } from '../../modules/session/session-metadata';
import { SessionMetadata, TreeItem, groupSplitFiles } from './session-history-grouping';
import { loadBatch, LoadMetadataTarget } from './session-history-metadata';

/** Target interface for fetch operations that need access to provider state. */
export interface FetchTarget extends LoadMetadataTarget {
    readonly metaStore: SessionMetadataStore;
}

const migratedDirsThisActivation = new Set<string>();

/** Run one-time sidecar migration for all relevant directories. */
async function migrateIfNeeded(
    folder: vscode.WorkspaceFolder | undefined,
    configuredDir: vscode.Uri | undefined,
    logDirOverride: vscode.Uri | undefined,
): Promise<void> {
    const allDirs = [configuredDir, logDirOverride, folder?.uri]
        .filter((d): d is vscode.Uri => d !== undefined && d !== null);
    const seen = new Set<string>();
    for (const dir of allDirs) {
        const key = dir.toString();
        if (seen.has(key) || migratedDirsThisActivation.has(key)) { continue; }
        seen.add(key);
        migratedDirsThisActivation.add(key);
        await migrateSidecarsInDirectory(dir, folder ?? undefined);
    }
}

/** Fetch session items from disk, loading metadata and grouping split files. */
export async function fetchItemsCore(
    target: FetchTarget,
    logDirOverride?: vscode.Uri,
): Promise<TreeItem[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder && !logDirOverride) { return []; }
    const configuredDir = folder ? getLogDirectoryUri(folder) : undefined;
    const logDir = logDirOverride ?? configuredDir!;
    await migrateIfNeeded(folder ?? undefined, configuredDir, logDirOverride);
    try {
        const { fileTypes, includeSubfolders } = getConfig();
        const logFiles = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
        const centralMeta = await target.metaStore.loadAllMetadata(logDir);
        const items = await loadBatch(target, logDir, logFiles, centralMeta);
        pruneCache(target, items);
        const grouped = groupSplitFiles(items);
        return grouped.sort((a, b) => b.mtime - a.mtime);
    } catch {
        return [];
    }
}

/** Remove cache entries for files no longer present on disk. */
function pruneCache(target: FetchTarget, currentItems: SessionMetadata[]): void {
    const liveUris = new Set(currentItems.map(i => i.uri.toString()));
    for (const [key] of target.metaCache) {
        const uri = key.slice(0, key.indexOf('|'));
        if (!liveUris.has(uri)) { target.metaCache.delete(key); }
    }
}
