/**
 * Crash dumps integration: at session end, scans configured directories for
 * .dmp/.mdmp/.core files whose mtime falls in the session time range.
 * Optionally copies discovered files into the session folder (copyToSession).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

/** Max total bytes to copy into session folder (500 MB). */
const MAX_COPY_TOTAL_BYTES = 500 * 1024 * 1024;

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('crashDumps');
}

function resolvePath(template: string, workspaceFolder: vscode.WorkspaceFolder): string {
    const workspacePath = resolveWorkspaceFileUri(workspaceFolder, '.').fsPath;
    let s = template.replace(/\$\{workspaceFolder\}/gi, workspacePath);
    s = s.replace(/\$\{env:([^}]+)\}/g, (_: string, name: string) => process.env[name] ?? '');
    return path.normalize(s);
}

interface WalkOpts {
    extensions: Set<string>;
    fromMs: number;
    toMs: number;
    maxFiles: number;
    maxDepth: number;
}

/** Max directory depth to avoid stack overflow on very deep trees. */
const WALK_MAX_DEPTH = 20;

function* walkFiles(
    dir: string,
    opts: WalkOpts,
    count: { value: number },
    depth: number,
): Generator<{ path: string; size: number; mtime: number }> {
    if (depth >= opts.maxDepth) { return; }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (count.value >= opts.maxFiles) { return; }
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walkFiles(full, opts, count, depth + 1);
        } else if (e.isFile()) {
            const ext = path.extname(e.name).toLowerCase();
            if (!opts.extensions.has(ext)) { continue; }
            let stat: fs.Stats;
            try {
                stat = fs.statSync(full);
            } catch {
                continue;
            }
            if (stat.mtimeMs >= opts.fromMs && stat.mtimeMs <= opts.toMs) {
                count.value += 1;
                yield { path: full, size: stat.size, mtime: stat.mtimeMs };
            }
        }
    }
}

export const crashDumpsProvider: IntegrationProvider = {
    id: 'crashDumps',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const { workspaceFolder, baseFileName, sessionStartTime, sessionEndTime } = context;
        const cfg = context.config.integrationsCrashDumps;
        const leadMs = cfg.leadMinutes * 60 * 1000;
        const lagMs = cfg.lagMinutes * 60 * 1000;
        const fromMs = sessionStartTime - leadMs;
        const toMs = sessionEndTime + lagMs;
        const searchPaths = cfg.searchPaths.length > 0
            ? cfg.searchPaths.map(p => resolvePath(p, workspaceFolder))
            : [
                resolveWorkspaceFileUri(workspaceFolder, '.').fsPath,
                process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'CrashDumps') : '',
                process.env.TEMP ?? '',
            ].filter(Boolean);
        const found: Array<{ path: string; size: number; mtime: number }> = [];
        const walkOpts: WalkOpts = {
            extensions: new Set(cfg.extensions.map(e => e.toLowerCase())),
            fromMs,
            toMs,
            maxFiles: cfg.maxFiles,
            maxDepth: WALK_MAX_DEPTH,
        };
        const count = { value: 0 };
        for (const dir of searchPaths) {
            try {
                if (!fs.statSync(dir).isDirectory()) { continue; }
                for (const f of walkFiles(dir, walkOpts, count, 0)) {
                    found.push(f);
                }
            } catch {
                // skip
            }
            if (found.length >= cfg.maxFiles) { break; }
        }
        if (found.length === 0) { return undefined; }

        type FileEntry = { path: string; size: number; mtime: number; copiedTo?: string };
        let files: FileEntry[] = found.map(f => ({ path: f.path, size: f.size, mtime: f.mtime }));
        let copiedCount = 0;

        // Optional copy into session folder: sequential copies, 500 MB cap, duplicate basenames get numeric suffix.
        if (cfg.copyToSession && context.logDirUri) {
            const usedNames = new Set<string>();
            let totalCopiedBytes = 0;

            /** Returns a unique basename in the session folder (suffix -1, -2, … if name already used). */
            function uniqueDestBasename(originalPath: string): string {
                const base = path.basename(originalPath);
                const ext = path.extname(base);
                const stem = ext ? base.slice(0, -ext.length) : base;
                let candidate = base;
                let n = 0;
                while (usedNames.has(candidate)) {
                    n += 1;
                    candidate = `${stem}-${n}${ext}`;
                }
                usedNames.add(candidate);
                return candidate;
            }

            const newFiles: FileEntry[] = [];
            for (const f of found) {
                const entry: FileEntry = { path: f.path, size: f.size, mtime: f.mtime };
                if (totalCopiedBytes + f.size > MAX_COPY_TOTAL_BYTES) {
                    newFiles.push(entry);
                    continue;
                }
                const destBasename = uniqueDestBasename(f.path);
                const destUri = vscode.Uri.joinPath(context.logDirUri, destBasename);
                try {
                    await vscode.workspace.fs.copy(vscode.Uri.file(f.path), destUri);
                    entry.copiedTo = destUri.fsPath;
                    totalCopiedBytes += f.size;
                    copiedCount += 1;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    context.outputChannel.appendLine(`[crashDumps] Copy failed ${f.path}: ${msg}`);
                }
                newFiles.push(entry);
            }
            files = newFiles;
        } else if (cfg.copyToSession && !context.logDirUri) {
            context.outputChannel.appendLine('[crashDumps] copyToSession enabled but session folder path not available; skipping copy.');
        }

        const payload = {
            count: found.length,
            copiedCount,
            sidecar: `${baseFileName}.crash-dumps.json`,
            files,
        };
        const sidecarContent = JSON.stringify({ count: found.length, copiedCount, files: payload.files }, null, 2);
        return [
            { kind: 'meta', key: 'crashDumps', payload },
            { kind: 'sidecar', filename: `${baseFileName}.crash-dumps.json`, content: sidecarContent, contentType: 'json' },
        ];
    },
};
