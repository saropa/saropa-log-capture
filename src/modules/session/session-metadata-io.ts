/**
 * Low-level I/O helpers for the central session metadata store.
 *
 * Pure functions that read/write the central .session-metadata.json file
 * and handle legacy .meta.json sidecar migration. Extracted from
 * SessionMetadataStore to keep the class file under the line limit.
 */
import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../config/config';
import { parseJSONOrDefault } from '../misc/safe-json';
import type { SessionMeta } from './session-metadata';

/** Central metadata file shape: relative path → SessionMeta. */
export type MetaMap = Record<string, SessionMeta>;

/** Resolve the URI of the central metadata file for a given log file. */
export function getCentralMetaUri(logUri: vscode.Uri): vscode.Uri | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(logUri) ?? vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    return vscode.Uri.joinPath(logDir, '.session-metadata.json');
}

/** Convert a log URI to a workspace-relative key (forward slashes). */
export function relativeKey(logUri: vscode.Uri): string {
    return vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
}

/** Build the legacy .meta.json sidecar URI for a log file. */
export function fallbackSidecarUri(logUri: vscode.Uri): vscode.Uri {
    const str = logUri.toString();
    const dotIdx = str.lastIndexOf('.');
    if (dotIdx === -1) { return vscode.Uri.parse(str + '.meta.json'); }
    return vscode.Uri.parse(str.slice(0, dotIdx) + '.meta.json');
}

/** Read the central metadata JSON file, returning an empty map on any error. */
export async function readCentral(uri: vscode.Uri): Promise<MetaMap> {
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const parsed = parseJSONOrDefault<MetaMap>(Buffer.from(data), {});
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

/** Write the full metadata map to the central JSON file, creating the directory if needed. */
export async function writeCentral(uri: vscode.Uri, data: MetaMap): Promise<void> {
    const dir = vscode.Uri.joinPath(uri, '..');
    try { await vscode.workspace.fs.createDirectory(dir); } catch { /* may exist */ }
    const json = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
}

/** Read a legacy .meta.json sidecar (migration only — never written by new code). */
export async function loadSidecar(logUri: vscode.Uri): Promise<SessionMeta> {
    const metaUri = fallbackSidecarUri(logUri);
    try {
        const data = await vscode.workspace.fs.readFile(metaUri);
        const parsed = parseJSONOrDefault<SessionMeta>(Buffer.from(data), {});
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}
