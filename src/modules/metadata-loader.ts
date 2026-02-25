/**
 * Shared helpers for loading session metadata sidecar files.
 * Used by both cross-session-aggregator and perf-aggregator.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './config';
import type { SessionMeta } from './session-metadata';

/** A loaded session metadata file with its parsed filename. */
export interface LoadedMeta {
    readonly filename: string;
    readonly meta: SessionMeta;
}

/** Time window for filtering sessions by age. */
export type TimeRange = '24h' | '7d' | '30d' | 'all';

const maxScanDepth = 10;
const timeRangeMs: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };

/** Parse a session date from a log filename like `20260224_163302_....log`. */
export function parseSessionDate(filename: string): number {
    const m = filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!m) { return 0; }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

/** Filter metadata entries by time range. */
export function filterByTime(metas: readonly LoadedMeta[], range: TimeRange): readonly LoadedMeta[] {
    if (range === 'all') { return metas; }
    const cutoff = Date.now() - (timeRangeMs[range] ?? 0);
    return metas.filter(m => parseSessionDate(m.filename) >= cutoff);
}

/** List all `.meta.json` files under the configured log directory. */
export async function listMetaFiles(logDir: vscode.Uri): Promise<string[]> {
    const { includeSubfolders } = getConfig();
    return collectMetaFiles(logDir, includeSubfolders ? maxScanDepth : 0, '');
}

async function collectMetaFiles(dir: vscode.Uri, depth: number, prefix: string): Promise<string[]> {
    let entries: [string, vscode.FileType][];
    try { entries = await vscode.workspace.fs.readDirectory(dir); } catch { return []; }
    const results: string[] = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        if (type === vscode.FileType.File && name.endsWith('.meta.json')) { results.push(rel); }
        // Skip dotfiles (.git, .vscode, etc.)
        else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
            results.push(...await collectMetaFiles(vscode.Uri.joinPath(dir, name), depth - 1, rel));
        }
    }
    return results;
}

/** Load and parse a single `.meta.json` file. Returns undefined on failure. */
export async function loadMeta(logDir: vscode.Uri, filename: string): Promise<LoadedMeta | undefined> {
    try {
        const uri = vscode.Uri.joinPath(logDir, filename);
        const data = await vscode.workspace.fs.readFile(uri);
        const meta = JSON.parse(Buffer.from(data).toString('utf-8')) as SessionMeta;
        const sessionFilename = filename.replace(/\.meta\.json$/, '');
        return { filename: sessionFilename, meta };
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
