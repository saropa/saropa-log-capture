/**
 * Package/lockfile integration: adds lockfile hash and package manager to session
 * header and meta for reproducibility. Sync-only, minimal I/O.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';

const LOCKFILE_PRIORITY = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

function isEnabled(context: IntegrationContext): boolean {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('packages');
}

function findLockfile(workspaceFolder: vscode.WorkspaceFolder): string | undefined {
    const root = workspaceFolder.uri.fsPath;
    for (const name of LOCKFILE_PRIORITY) {
        const p = `${root}/${name}`;
        try {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) { return name; }
        } catch {
            // continue
        }
    }
    return undefined;
}

/** Max bytes to read from lockfile (avoids blocking on huge files). Hash is over first N bytes only. */
const LOCKFILE_MAX_READ = 2 * 1024 * 1024;

/** Sync read + hash; returns undefined on error or missing. Reads at most LOCKFILE_MAX_READ bytes. */
function readAndHashLockfile(workspaceFolder: vscode.WorkspaceFolder, filename: string): string | undefined {
    try {
        const absPath = vscode.Uri.joinPath(workspaceFolder.uri, filename).fsPath;
        const fd = fs.openSync(absPath, 'r');
        const buf = Buffer.alloc(Math.min(LOCKFILE_MAX_READ, fs.fstatSync(fd).size));
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const hash = crypto.createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex').slice(0, 12);
        return hash;
    } catch {
        return undefined;
    }
}

export const packageLockfileProvider: IntegrationProvider = {
    id: 'packages',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const { workspaceFolder } = context;
        const lockfile = findLockfile(workspaceFolder);
        if (!lockfile) { return undefined; }
        const hash = readAndHashLockfile(workspaceFolder, lockfile);
        if (!hash) { return undefined; }
        const manager = lockfile === 'package-lock.json' ? 'npm' : lockfile === 'yarn.lock' ? 'yarn' : 'pnpm';
        const lines = [`Lockfile:     ${manager} (${lockfile}) sha256:${hash}`];
        const payload = { packageManager: manager, lockfile, contentHash: hash };
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'packages', payload },
        ];
    },
};
