/**
 * Tails configured external log files during a session. Buffers new lines
 * in memory; at session end the external-logs provider reads buffers and
 * writes sidecars. Start/stop from session lifecycle.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IntegrationExternalLogsConfig } from '../config/config-types';
import type { WorkspaceFolder } from 'vscode';
import { resolveWorkspaceFileUri } from './workspace-path';

/** Per-file buffer: lines collected during tail. */
const buffersByLabel = new Map<string, string[]>();
/** Watchers and read state per path; disposed on stop. */
const watchers: Array<{ close: () => void }> = [];
/** Debounce timers used to batch fs.watch change bursts. */
const debounceTimeouts = new Set<ReturnType<typeof setTimeout>>();
/** Config used for max lines; set at start. */
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

/**
 * Start tailing configured paths. Resolves paths against workspace; for each
 * existing file, watches for changes and appends new lines to a per-file buffer.
 * Missing files are logged and skipped (no session failure).
 */
export function startExternalLogTailers(
    workspaceFolder: WorkspaceFolder,
    paths: readonly string[],
    config: IntegrationExternalLogsConfig,
    outputChannel: { appendLine(line: string): void },
): void {
    stopExternalLogTailers();
    buffersByLabel.clear();
    maxLinesPerFile = Math.max(100, Math.min(1_000_000, config.maxLinesPerFile));

    for (const relPath of paths) {
        const uri = resolveWorkspaceFileUri(workspaceFolder, relPath);
        const filePath = uri.fsPath;
        try {
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) {
                outputChannel.appendLine(`[externalLogs] Not a file, skipped: ${relPath}`);
                continue;
            }
        } catch {
            outputChannel.appendLine(`[externalLogs] External log not found: ${relPath}`);
            continue;
        }

        const label = pathToLabel(relPath);
        const buffer: string[] = [];
        buffersByLabel.set(label, buffer);

        const cap = (): void => {
            while (buffer.length > maxLinesPerFile) {
                buffer.shift();
            }
        };

        let position = 0;
        try {
            const stat = fs.statSync(filePath);
            position = stat.size;
        } catch {
            // use 0
        }

        const readNewBytes = (fromPos: number): number => {
            try {
                const stat = fs.statSync(filePath);
                if (stat.size <= fromPos) { return fromPos; }
                const toRead = stat.size - fromPos;
                const fd = fs.openSync(filePath, 'r');
                try {
                    const buf = Buffer.alloc(toRead);
                    fs.readSync(fd, buf, 0, toRead, fromPos);
                    // Position advances by byte length read; line split is UTF-8 string (multi-byte chars across chunk boundaries are rare for log text).
                    const chunk = buf.toString('utf-8').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
                    const lines = chunk.split('\n');
                    const complete = chunk.endsWith('\n') ? lines : lines.slice(0, -1);
                    for (const line of complete) {
                        buffer.push(line ?? '');
                    }
                    cap();
                    const consumed = complete.length === 0 ? 0 : Buffer.byteLength(complete.join('\n') + '\n', 'utf-8');
                    return fromPos + Math.min(consumed, toRead);
                } finally {
                    fs.closeSync(fd);
                }
            } catch {
                return fromPos;
            }
        };

        const onChange = (): void => {
            try {
                const stat = fs.statSync(filePath);
                if (stat.size > position) {
                    position = readNewBytes(position);
                } else if (stat.size < position) {
                    position = stat.size;
                    position = readNewBytes(position);
                }
            } catch {
                // file deleted or unreadable
            }
        };

        let pendingRead = false;
        let scheduledRead = false;
        const requestRead = (): void => {
            pendingRead = true;
            if (scheduledRead) { return; }
            scheduledRead = true;
            const t = setTimeout(() => {
                debounceTimeouts.delete(t);
                scheduledRead = false;
                if (!pendingRead) { return; }
                pendingRead = false;
                onChange();
            }, 50);
            debounceTimeouts.add(t);
        };

        try {
            const base = path.basename(filePath);
            const w = fs.watch(filePath, { persistent: false }, (_, eventFilename) => {
                // Windows often passes null for filename; still read new bytes for this watched path.
                if (eventFilename === null || eventFilename === undefined || eventFilename === base) {
                    // Debounce fs.watch bursts: schedule one synchronous read after the burst settles.
                    // This reduces extension-host stalls under heavy log churn.
                    requestRead();
                }
            });
            watchers.push({
                close: () => {
                    try {
                        w.close();
                    } catch {
                        // ignore
                    }
                },
            });
            onChange();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`[externalLogs] Watch failed for ${relPath}: ${msg}`);
            buffersByLabel.delete(label);
        }
    }
}

/** Stop all watchers and clear state. Call at session end. */
export function stopExternalLogTailers(): void {
    for (const w of watchers) {
        try {
            w.close();
        } catch {
            // ignore
        }
    }
    watchers.length = 0;
    buffersByLabel.clear();
    for (const t of debounceTimeouts) {
        try { clearTimeout(t); } catch { /* ignore */ }
    }
    debounceTimeouts.clear();
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
