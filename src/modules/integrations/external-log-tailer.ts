/**
 * Tails configured external log files during a session. Buffers new lines in
 * memory; at session end the external-logs provider reads buffers and writes
 * sidecars. Start/stop from session lifecycle.
 *
 * Each configured path gets a TailWorker that handles late appearance
 * (createIfMissing / glob), rotation (followRotation), and incremental reads.
 * Glob paths (`logs/*.log`) tail the most recently modified match.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IntegrationExternalLogsConfig } from '../config/config-types';
import type { WorkspaceFolder } from 'vscode';
import { resolveWorkspaceFileUri } from './workspace-path';
import { isGlobPattern, resolveExternalLogPath } from './external-log-glob';
import { TailWorker } from './external-log-tail-worker';

/** Per-file buffer: lines collected during tail. */
const buffersByLabel = new Map<string, string[]>();
/** Active tail workers; disposed on stop. */
const workers: TailWorker[] = [];
/** Debounce timers used to batch fs.watch change bursts. */
const debounceTimeouts = new Set<ReturnType<typeof setTimeout>>();
/** Notified with the count of files currently being tailed (for the status bar). */
let onActiveCountChange: ((count: number) => void) | undefined;
/** Per-file line cap; set at start from config (clamped). */
let maxLinesPerFile = 10_000;

/**
 * Sanitize a path to a short label for sidecar filename and source id.
 * e.g. "logs/app.log" -> "app", "logs/nginx/error.log" -> "error"
 */
export function pathToLabel(relPath: string): string {
    const parts = relPath.split(/[/\\]/g).filter(Boolean);
    // For typical "logs/<file>.log", keep only the file stem.
    if (parts.length === 2) {
        const stem = parts[1].replace(/\.[^.]+$/, '');
        return stem || 'external';
    }
    const normalized = parts.join('_');
    const noExt = normalized.replace(/\.[^.]+$/, '');
    return noExt || 'external';
}

/** Notify the status-bar callback with the current attached-file count. */
function notifyActiveCount(): void {
    onActiveCountChange?.(workers.filter((w) => w.isAttached()).length);
}

/** Directory to watch for a path's appearance/rotation (the literal directory part). */
function watchDirForPath(workspaceFolder: WorkspaceFolder, relPath: string): string {
    const segments = relPath.split(/[/\\]/g).filter(Boolean);
    segments.pop();
    const dirRel = segments.join('/');
    return resolveWorkspaceFileUri(workspaceFolder, dirRel || '.').fsPath;
}

/** Current existing file to tail for this path, or undefined if none yet. */
function existingTailPath(workspaceFolder: WorkspaceFolder, relPath: string): string | undefined {
    const resolved = resolveExternalLogPath(workspaceFolder, relPath);
    if (!resolved) { return undefined; }
    try { return fs.statSync(resolved).isFile() ? resolved : undefined; } catch { return undefined; }
}

/** createIfMissing: create an empty file (and parent dirs) so the app can append immediately. */
function ensureFileExists(workspaceFolder: WorkspaceFolder, relPath: string, outputChannel: { appendLine(l: string): void }): void {
    const p = resolveWorkspaceFileUri(workspaceFolder, relPath).fsPath;
    try {
        if (fs.existsSync(p)) { return; }
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, '');
        outputChannel.appendLine(`[externalLogs] Created empty log to tail: ${relPath}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[externalLogs] createIfMissing failed for ${relPath}: ${msg}`);
    }
}

/** Build and start a tail worker for one configured path. */
function setupTail(
    workspaceFolder: WorkspaceFolder,
    relPath: string,
    config: IntegrationExternalLogsConfig,
    outputChannel: { appendLine(l: string): void },
): void {
    const buffer: string[] = [];
    buffersByLabel.set(pathToLabel(relPath), buffer);
    const glob = isGlobPattern(relPath);
    // createIfMissing only makes sense for a concrete path, not a glob pattern.
    if (!glob && config.createIfMissing) { ensureFileExists(workspaceFolder, relPath, outputChannel); }
    const worker = new TailWorker({
        buffer,
        maxLines: maxLinesPerFile,
        followRotation: config.followRotation,
        watchForAppearance: config.createIfMissing || glob,
        watchDir: watchDirForPath(workspaceFolder, relPath),
        resolveLatest: () => existingTailPath(workspaceFolder, relPath),
        outputChannel,
        onAttachedChange: notifyActiveCount,
        registerTimeout: (t) => debounceTimeouts.add(t),
    });
    workers.push(worker);
    worker.start();
}

/**
 * Start tailing configured paths. Resolves each path (with glob support);
 * existing files are watched immediately, missing ones wait for appearance when
 * createIfMissing/glob, otherwise are logged and skipped (no session failure).
 */
export function startExternalLogTailers(
    workspaceFolder: WorkspaceFolder,
    config: IntegrationExternalLogsConfig,
    outputChannel: { appendLine(line: string): void },
    onCountChange?: (count: number) => void,
): void {
    stopExternalLogTailers();
    onActiveCountChange = onCountChange;
    maxLinesPerFile = Math.max(100, Math.min(1_000_000, config.maxLinesPerFile));
    for (const relPath of config.paths) {
        setupTail(workspaceFolder, relPath, config, outputChannel);
    }
    notifyActiveCount();
}

/** Stop all workers and clear state. Call at session end. */
export function stopExternalLogTailers(): void {
    for (const w of workers) {
        try { w.close(); } catch { /* ignore */ }
    }
    workers.length = 0;
    buffersByLabel.clear();
    for (const t of debounceTimeouts) {
        try { clearTimeout(t); } catch { /* ignore */ }
    }
    debounceTimeouts.clear();
    if (onActiveCountChange) {
        onActiveCountChange(0);
        onActiveCountChange = undefined;
    }
}

/**
 * Return a snapshot of buffered lines per label (for use at session end).
 * Does not clear buffers; stopExternalLogTailers clears.
 */
export function getExternalLogBuffers(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [label, lines] of buffersByLabel) {
        out.set(label, [...lines]);
    }
    return out;
}
