/**
 * Shared helpers for loading session metadata from the central store.
 * Used by cross-session-aggregator and perf-aggregator.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from '../config/config';
import { SessionMetadataStore } from './session-metadata';
import type { SessionMeta } from './session-metadata';

/** A loaded session with its log filename and metadata. */
export interface LoadedMeta {
    readonly filename: string;
    readonly meta: SessionMeta;
}

/** Time window for filtering sessions by age. */
export type TimeRange = '24h' | '7d' | '30d' | 'all';

const timeRangeMs: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };

/** Parse a session date from a log filename like `20260224_163302_....log`. */
export function parseSessionDate(filename: string): number {
    const base = filename.split('/').pop() ?? filename;
    const m = base.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!m) { return 0; }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

/** Filter metadata entries by time range. */
export function filterByTime(metas: readonly LoadedMeta[], range: TimeRange, nowMs: number = Date.now()): readonly LoadedMeta[] {
    if (range === 'all') { return metas; }
    const cutoff = nowMs - (timeRangeMs[range] ?? 0);
    return metas.filter(m => parseSessionDate(m.filename) >= cutoff);
}

/** List log file relative paths under the configured log directory (used for metadata lookup). */
export async function listMetaFiles(logDir: vscode.Uri): Promise<string[]> {
    const { fileTypes, includeSubfolders } = getConfig();
    return readTrackedFiles(logDir, fileTypes, includeSubfolders);
}

/** Load metadata for one log file from the central store. */
export async function loadMeta(logDir: vscode.Uri, logRelPath: string): Promise<LoadedMeta | undefined> {
    try {
        const uri = vscode.Uri.joinPath(logDir, logRelPath);
        const store = new SessionMetadataStore();
        const meta = await store.loadMetadata(uri);
        return { filename: logRelPath, meta };
    } catch { return undefined; }
}

/** Load all session metadata for the current workspace, filtered by time range. */
export async function loadFilteredMetas(timeRange: TimeRange = 'all'): Promise<readonly LoadedMeta[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return []; }
    const logDir = getLogDirectoryUri(folder);
    const entries = await listMetaFiles(logDir);
    const metas = await Promise.all(entries.map(e => loadMeta(logDir, e)));
    const valid = metas.filter((m): m is LoadedMeta => m !== undefined);
    return filterByTime(valid, timeRange);
}

/** Load session metadata only for the given relative paths under the log directory. */
export async function loadMetasForPaths(logDir: vscode.Uri, relativePaths: string[]): Promise<readonly LoadedMeta[]> {
    const metas = await Promise.all(relativePaths.map(p => loadMeta(logDir, p)));
    return metas.filter((m): m is LoadedMeta => m !== undefined);
}
