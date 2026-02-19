/** Low-level I/O helpers for Crashlytics: CLI runner and event cache read/write. */

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { getLogDirectoryUri } from './config';
import type { CrashlyticsIssueEvents, CrashlyticsEventDetail } from './crashlytics-types';

/** Shared timeout (ms) for both CLI commands and HTTP requests. */
export const apiTimeout = 10_000;

/** Run a shell command and resolve with trimmed stdout, or reject on non-zero exit. */
export function runCmd(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: apiTimeout, shell: true }, (err, stdout, stderr) => {
            if (err) {
                (err as Error & { stderr?: string }).stderr = (stderr ?? '').trim();
                reject(err);
                return;
            }
            resolve((stdout ?? '').trim());
        });
    });
}

/** Resolve the on-disk cache path for a given Crashlytics issue ID. */
function getCacheUri(issueId: string): vscode.Uri | undefined {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return undefined; }
    return vscode.Uri.joinPath(getLogDirectoryUri(ws), 'crashlytics', `${issueId}.json`);
}

/** Read cached crash events from disk; migrates v1 single-event format on the fly. */
export async function readCachedEvents(issueId: string): Promise<CrashlyticsIssueEvents | undefined> {
    const uri = getCacheUri(issueId);
    if (!uri) { return undefined; }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
        if (parsed.events && Array.isArray(parsed.events)) { return parsed as CrashlyticsIssueEvents; }
        // Migrate v1 single-event cache to multi-event format
        const detail = parsed as CrashlyticsEventDetail;
        return { issueId, events: [detail], currentIndex: 0 };
    } catch { return undefined; }
}

/** Persist crash events to the on-disk cache, creating the directory if needed. */
export async function writeCacheEvents(issueId: string, data: CrashlyticsIssueEvents): Promise<void> {
    const uri = getCacheUri(issueId);
    if (!uri) { return; }
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
}
