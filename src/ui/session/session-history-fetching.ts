/**
 * Fetch, cache, and migration logic for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from '../../modules/config/config';
import { SessionMetadataStore, migrateSidecarsInDirectory } from '../../modules/session/session-metadata';
import { loadLoadedFileHistory, type LoadedFileHistoryEntry } from '../../modules/session/loaded-files-history';
import { SessionMetadata, TreeItem, groupSplitFiles, groupSessionGroups } from './session-history-grouping';
import { loadBatch, LoadMetadataTarget, type OnItemLoaded, type SessionPreviewRecord } from './session-history-metadata';

/** Target interface for fetch operations that need access to provider state. */
export interface FetchTarget extends LoadMetadataTarget {
    readonly metaStore: SessionMetadataStore;
}

/** Callbacks for progressive loading in fetchItemsCore. */
export interface FetchCallbacks {
    /**
     * Fired once after the cheap stat pass with mtime/size for every file, before any
     * file body is read. Lets the caller paint a day-grouped skeleton immediately —
     * grouping needs only mtime, and the expensive parseHeader pass follows separately.
     */
    readonly onItemPreview?: (previews: readonly SessionPreviewRecord[]) => void;
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
        /* List all files and load the central metadata store in parallel. The progressive
           skeleton is now driven by loadBatch's cheap stat pass (onItemPreview), not by
           per-directory filename batches — grouping needs mtime, which only stat provides. */
        const [logFiles, centralMeta] = await Promise.all([
            readTrackedFiles(logDir, fileTypes, includeSubfolders),
            target.metaStore.loadAllMetadata(logDir),
        ]);
        const items = await loadBatch(target, logDir, logFiles, {
            centralMeta,
            onItemLoaded: callbacks?.onItemLoaded,
            onItemPreview: callbacks?.onItemPreview,
        });
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
        // Inject manually-loaded files (any path-load). The history is read from `logDir` — which
        // is exactly the directory the panel is showing (override root, else workspace default) and
        // the SAME dir recordLoadedFile writes to (both resolve via getActiveLogDirectoryUri) — so
        // recording and listing always agree. Each row's mtime is its LOAD time, so the existing
        // day-grouping files it under when it was loaded. Dedupe against the scan so a file already
        // in the listed folder is shown once.
        const loadedItems = await loadHistoryItems(logDir, items);
        return [...finalItems, ...loadedItems].sort((a, b) => b.mtime - a.mtime);
    } catch {
        return [];
    }
}

/** Map loaded-files-history entries to standalone session rows, skipping any file the
 *  directory scan already surfaced (deduped by URI). Reads from the panel's current `logDir`. */
async function loadHistoryItems(
    logDir: vscode.Uri,
    scanned: readonly SessionMetadata[],
): Promise<SessionMetadata[]> {
    const history = await loadLoadedFileHistory(logDir);
    if (history.length === 0) { return []; }
    const scannedUris = new Set(scanned.map(i => i.uri.toString()));
    return buildLoadedHistoryRows(history, scannedUris);
}

/** Pure: filter history entries to those NOT already scanned, then map to rows. Exported for
 *  unit testing the dedup + mapping without touching the filesystem. */
export function buildLoadedHistoryRows(
    history: readonly LoadedFileHistoryEntry[],
    scannedUris: ReadonlySet<string>,
): SessionMetadata[] {
    return history
        .filter(entry => !scannedUris.has(entry.uri))
        .map(historyEntryToSessionMetadata);
}

/** Convert a history entry into a SessionMetadata row. `mtime` is the load time so the
 *  row day-groups under when it was loaded; `loadedManually` flags it for the webview. */
function historyEntryToSessionMetadata(entry: LoadedFileHistoryEntry): SessionMetadata {
    return {
        uri: vscode.Uri.parse(entry.uri),
        filename: entry.filename,
        size: entry.size,
        mtime: entry.loadedAt,
        date: entry.date,
        project: entry.project,
        adapter: entry.adapter,
        lineCount: entry.lineCount,
        hasTimestamps: entry.hasTimestamps,
        durationMs: entry.durationMs,
        errorCount: entry.errorCount,
        warningCount: entry.warningCount,
        perfCount: entry.perfCount,
        anrCount: entry.anrCount,
        infoCount: entry.infoCount,
        debugCount: entry.debugCount,
        databaseCount: entry.databaseCount,
        todoCount: entry.todoCount,
        noticeCount: entry.noticeCount,
        loadedManually: true,
    };
}

/** Remove cache entries for files no longer present on disk. */
function pruneCache(target: FetchTarget, currentItems: SessionMetadata[]): void {
    const liveUris = new Set(currentItems.map(i => i.uri.toString()));
    for (const [key] of target.metaCache) {
        const uri = key.slice(0, key.indexOf('|'));
        if (!liveUris.has(uri)) { target.metaCache.delete(key); }
    }
}
