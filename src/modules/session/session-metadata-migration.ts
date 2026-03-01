/**
 * Migration of .meta.json sidecars into the central .session-metadata.json store.
 * Extracted from session-metadata.ts to keep the main file under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from '../config/config';
import type { SessionMeta } from './session-metadata';

const maxScanDepth = 10;

/**
 * Migrate .meta.json sidecars in a given directory into the central metadata store.
 * When workspaceFolder is provided, all metadata goes in configured log dir's .session-metadata.json
 * (keys = workspace-relative paths). When not (e.g. single-folder workspace), uses logDir/.session-metadata.json.
 * @returns Number of sidecar files migrated and removed.
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
    for (const rel of sidecarRels) {
        const base = rel.replace(/\.meta\.json$/i, '');
        let logRel: string | undefined;
        for (const ext of fileTypes) {
            const e = ext.startsWith('.') ? ext : `.${ext}`;
            const candidate = base + e;
            try {
                await vscode.workspace.fs.stat(vscode.Uri.joinPath(logDir, candidate));
                logRel = candidate.replace(/\\/g, '/');
                break;
            } catch { /* try next */ }
        }
        if (!logRel) { continue; }
        const logUri = vscode.Uri.joinPath(logDir, logRel);
        const key = vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
        const sidecarUri = vscode.Uri.joinPath(logDir, rel);
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
    return migrated;
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
