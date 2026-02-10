/** Persistent store for error triage status (open/closed/muted). */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from './config';

/** Possible error lifecycle states. */
export type ErrorStatus = 'open' | 'closed' | 'muted';

/** Status entry for a single error fingerprint. */
interface ErrorStatusEntry {
    readonly status: ErrorStatus;
    readonly updatedAt: number;
}

/** Map of fingerprint hash to status entry. */
type StatusMap = Record<string, ErrorStatusEntry>;

const filename = '.error-status.json';

function getStatusUri(): vscode.Uri | undefined {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return undefined; }
    return vscode.Uri.joinPath(getLogDirectoryUri(ws), filename);
}

/** Load all error statuses from the store. */
async function loadStatuses(): Promise<StatusMap> {
    const uri = getStatusUri();
    if (!uri) { return {}; }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(raw).toString('utf-8')) as StatusMap;
    } catch { return {}; }
}

/** Get statuses for multiple hashes at once (for batch rendering). */
export async function getErrorStatusBatch(hashes: readonly string[]): Promise<Record<string, ErrorStatus>> {
    const map = await loadStatuses();
    const result: Record<string, ErrorStatus> = {};
    for (const h of hashes) {
        result[h] = map[h]?.status ?? 'open';
    }
    return result;
}

/** Set the status of a single error by hash. 'open' deletes the entry. */
export async function setErrorStatus(hash: string, status: ErrorStatus): Promise<void> {
    const uri = getStatusUri();
    if (!uri) { return; }
    const map = await loadStatuses();
    if (status === 'open') {
        delete map[hash];
    } else {
        map[hash] = { status, updatedAt: Date.now() };
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(map, null, 2)));
}
