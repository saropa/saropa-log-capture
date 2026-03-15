/**
 * Migration of .meta.json sidecars into the central .session-metadata.json store.
 * Also cleans up orphan sidecars (created by a bug where the extension wrote .meta.json
 * next to arbitrary files outside the log directory).
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from '../config/config';
import type { SessionMeta } from './session-metadata';

const maxScanDepth = 10;

/** Returns true if parsed JSON matches the extension's session metadata shape. */
export function isOurSidecar(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) { return false; }
    const rec = obj as Record<string, unknown>;
    return typeof rec['errorCount'] === 'number' || typeof rec['infoCount'] === 'number'
        || typeof rec['fwCount'] === 'number' || typeof rec['warningCount'] === 'number';
}

/**
 * Migrate .meta.json sidecars in a given directory into the central metadata store.
 * Orphan sidecars (no matching tracked file) are deleted if they match our format.
 * @returns Number of sidecar files migrated or cleaned up.
 */
export async function migrateSidecarsInDirectory(
    logDir: vscode.Uri,
    workspaceFolder?: vscode.WorkspaceFolder,
): Promise<number> {
    const { fileTypes, includeSubfolders } = getConfig();
    const sidecarRels = await listMetaJsonFiles(logDir, includeSubfolders ? maxScanDepth : 0, '');
    const centralUri = workspaceFolder
        ? vscode.Uri.joinPath(getLogDirectoryUri(workspaceFolder), '.session-metadata.json')
        : vscode.Uri.joinPath(logDir, '.session-metadata.json');
    type MetaMap = Record<string, SessionMeta>;
    let data: MetaMap = {};
    try {
        const raw = await vscode.workspace.fs.readFile(centralUri);
        data = JSON.parse(Buffer.from(raw).toString('utf-8')) as MetaMap;
    } catch { /* no central file yet */ }
    let migrated = 0;
    let cleaned = 0;
    for (const rel of sidecarRels) {
        const sidecarUri = vscode.Uri.joinPath(logDir, rel);
        const base = rel.replace(/\.meta\.json$/i, '');
        const logRel = await findTrackedFile(logDir, base, fileTypes);
        if (!logRel) {
            cleaned += await deleteIfOurs(sidecarUri);
            continue;
        }
        const logUri = vscode.Uri.joinPath(logDir, logRel);
        const key = vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
        try {
            const raw = await vscode.workspace.fs.readFile(sidecarUri);
            const meta = JSON.parse(Buffer.from(raw).toString('utf-8')) as SessionMeta;
            data[key] = meta;
            await vscode.workspace.fs.delete(sidecarUri);
            migrated++;
        } catch { /* skip broken or locked files */ }
    }
    if (migrated > 0) {
        const dir = vscode.Uri.joinPath(centralUri, '..');
        try { await vscode.workspace.fs.createDirectory(dir); } catch { /* may exist */ }
        await vscode.workspace.fs.writeFile(centralUri, Buffer.from(JSON.stringify(data, null, 2), 'utf-8'));
    }
    return migrated + cleaned;
}

/** Find a tracked file matching the sidecar base name. */
async function findTrackedFile(
    logDir: vscode.Uri, base: string, fileTypes: readonly string[],
): Promise<string | undefined> {
    for (const ext of fileTypes) {
        const e = ext.startsWith('.') ? ext : `.${ext}`;
        const candidate = base + e;
        try {
            await vscode.workspace.fs.stat(vscode.Uri.joinPath(logDir, candidate));
            return candidate.replace(/\\/g, '/');
        } catch { /* try next */ }
    }
    return undefined;
}

/** Delete a sidecar file only if its content matches our metadata format. Returns 1 if deleted. */
async function deleteIfOurs(uri: vscode.Uri): Promise<number> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8')) as unknown;
        if (!isOurSidecar(parsed)) { return 0; }
        await vscode.workspace.fs.delete(uri);
        return 1;
    } catch { return 0; }
}

/** Migrate sidecars in the configured log dir. Convenience for migrateSidecarsInDirectory(getLogDirectoryUri(folder)). */
export async function migrateAllSidecarsToCentral(workspaceFolder: vscode.WorkspaceFolder): Promise<number> {
    return migrateSidecarsInDirectory(getLogDirectoryUri(workspaceFolder));
}

async function listMetaJsonFiles(dir: vscode.Uri, depth: number, prefix: string): Promise<string[]> {
    let entries: [string, vscode.FileType][];
    try { entries = await vscode.workspace.fs.readDirectory(dir); } catch { return []; }
    const results: string[] = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        if (type === vscode.FileType.File && name.toLowerCase().endsWith('.meta.json')) {
            results.push(rel);
        } else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
            results.push(...await listMetaJsonFiles(vscode.Uri.joinPath(dir, name), depth - 1, rel));
        }
    }
    return results;
}
