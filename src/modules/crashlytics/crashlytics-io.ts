/** Low-level I/O helpers for Crashlytics: CLI runner and event cache read/write. */

import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { getLogDirectoryUri, getSaropaCacheCrashlyticsUri } from '../config/config';
import { readDirectoryIfExistsAsDirectory } from '../misc/vscode-fs-read-directory-safe';
import type { CrashlyticsIssueEvents, CrashlyticsEventDetail } from './crashlytics-types';

/** Shared timeout (ms) for both CLI commands and HTTP requests. */
export const apiTimeout = 10_000;

/** Run a shell command and resolve with trimmed stdout, or reject on non-zero exit. */
export function runCmd(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: apiTimeout, shell: true }, (err, stdout, stderr) => {
            if (err) {
                let error: Error;
                if (err instanceof Error) {
                    error = err;
                } else if (typeof err === 'string') {
                    error = new Error(err);
                } else {
                    error = new Error('Command failed');
                }
                (error as Error & { stderr?: string }).stderr = (stderr ?? '').trim();
                reject(error);
                return;
            }
            resolve((stdout ?? '').trim());
        });
    });
}

/** Resolve the on-disk cache path for a given Crashlytics issue ID (.saropa/cache/crashlytics/). */
function getCacheUri(issueId: string): vscode.Uri | undefined {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return undefined; }
    return vscode.Uri.joinPath(getSaropaCacheCrashlyticsUri(ws), `${issueId}.json`);
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

/** Persist crash events to the on-disk cache, creating the directory if needed. Never throws. */
export async function writeCacheEvents(issueId: string, data: CrashlyticsIssueEvents): Promise<void> {
    try {
        const uri = getCacheUri(issueId);
        if (!uri) { return; }
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
    } catch {
        // Cache write failure is non-fatal; skip silently
    }
}

/**
 * One-time migration: move legacy `{logDirectory}/crashlytics/*.json` into
 * `.saropa/cache/crashlytics/`. Invoked from extension activation.
 *
 * Uses {@link readDirectoryIfExistsAsDirectory} so workspaces that never had the old
 * folder do not hit `readDirectory` on a missing path (avoids spurious host console noise).
 * Migration failures are swallowed; data loss is limited to failing mid-copy (extremely rare).
 */
export async function migrateCrashlyticsCacheToSaropa(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    try {
        const oldDir = vscode.Uri.joinPath(getLogDirectoryUri(workspaceFolder), 'crashlytics');
        const newDir = getSaropaCacheCrashlyticsUri(workspaceFolder);
        const entries = await readDirectoryIfExistsAsDirectory(vscode.workspace.fs, oldDir);
        const files = entries.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'));
        if (files.length === 0) { return; }
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(newDir, '..'));
        await vscode.workspace.fs.createDirectory(newDir);
        for (const [name] of files) {
            const src = vscode.Uri.joinPath(oldDir, name);
            const dest = vscode.Uri.joinPath(newDir, name);
            const raw = await vscode.workspace.fs.readFile(src);
            await vscode.workspace.fs.writeFile(dest, raw);
        }
        for (const [name] of files) {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(oldDir, name));
        }
        await vscode.workspace.fs.delete(oldDir);
    } catch {
        // Migration failure is non-fatal
    }
}
