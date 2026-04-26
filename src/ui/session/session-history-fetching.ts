/**
 * Fetch, cache, and migration logic for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles, readTrackedFilesStreaming } from '../../modules/config/config';
import { SessionMetadataStore, migrateSidecarsInDirectory } from '../../modules/session/session-metadata';
import { SessionMetadata, TreeItem, groupSplitFiles, groupSessionGroups } from './session-history-grouping';
import { loadBatch, LoadMetadataTarget, type OnItemLoaded } from './session-history-metadata';

/** Target interface for fetch operations that need access to provider state. */
export interface FetchTarget extends LoadMetadataTarget {
    readonly metaStore: SessionMetadataStore;
}

/** Callbacks for progressive loading in fetchItemsCore. */
export interface FetchCallbacks {
    /**
     * Fired incrementally as files are discovered in each directory.
     * Called once per directory level during streaming scan, so callers can
     * show filenames immediately instead of waiting for the full recursive scan.
     */
    readonly onFilesFound?: (files: readonly string[], logDir: vscode.Uri) => void;
    /** Fired after each file's metadata finishes loading. */
    readonly onItemLoaded?: OnItemLoaded;
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
    callbacks?: FetchCallbacks,
): Promise<TreeItem[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder && !logDirOverride) { return []; }
    const configuredDir = folder ? getLogDirectoryUri(folder) : undefined;
    const logDir = logDirOverride ?? configuredDir!;
    /* Migration is best-effort — fire-and-forget so it never delays file listing. */
    migrateIfNeeded(folder ?? undefined, configuredDir, logDirOverride).catch(() => {});
    try {
        const { fileTypes, includeSubfolders } = getConfig();
        /* Stream file names to the caller per-directory so the first batch appears
           immediately, and load the central metadata store in parallel. */
        const onBatch = callbacks?.onFilesFound
            ? (files: readonly string[]) => { try { callbacks.onFilesFound!(files, logDir); } catch { /* non-critical */ } }
            : undefined;
        const [logFiles, centralMeta] = await Promise.all([
            onBatch
                ? readTrackedFilesStreaming(logDir, fileTypes, includeSubfolders, onBatch)
                : readTrackedFiles(logDir, fileTypes, includeSubfolders),
            target.metaStore.loadAllMetadata(logDir),
        ]);
        const items = await loadBatch(target, logDir, logFiles, { centralMeta, onItemLoaded: callbacks?.onItemLoaded });
        pruneCache(target, items);
        const splitGrouped = groupSplitFiles(items);
        // Session-group coalescing runs AFTER split-group coalescing so that a multi-part DAP
        // session (rotated into _001.log / _002.log) lands as one SplitGroup that then becomes
        // one member of its SessionGroup \u2014 not N individual group members. Feature-gated on the
        // user setting so disabling returns the pre-feature rendering exactly as before.
        const cfg = getConfig().sessionGroups;
        const hostFolder = vscode.workspace.getWorkspaceFolder(logDir);
        const preferredWorkspaceFolderName = hostFolder?.name;
        const finalItems = cfg.enabled
            ? groupSessionGroups(splitGrouped, preferredWorkspaceFolderName)
            : splitGrouped;
        return finalItems.sort((a, b) => b.mtime - a.mtime);
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
