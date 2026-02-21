/**
 * Watches a Claude Code JSONL session file for new AI activity.
 *
 * Uses byte-offset tailing (reads only new bytes on change) and a
 * lookback scan on startup to surface recent activity from before
 * the debug session started.
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import { AiActivityEntry } from './ai-jsonl-types';
import { parseJsonlChunk } from './ai-jsonl-parser';
import { resolveActiveSession } from './ai-session-resolver';

/** Maximum bytes to read when performing the initial lookback scan. */
const lookbackBytes = 256 * 1024;

/** Default debounce interval between reads (ms). */
const defaultDebounceMs = 500;

export interface AiWatcherOptions {
    /** How far back to look for AI activity on startup (ms). Default: 30 min. */
    readonly lookbackMs: number;
    /** Minimum interval between reads (ms). Default: 500. */
    readonly debounceMs?: number;
}

export class AiWatcher implements vscode.Disposable {
    private readonly _onEntries = new vscode.EventEmitter<AiActivityEntry[]>();
    readonly onEntries: vscode.Event<AiActivityEntry[]> = this._onEntries.event;

    private watcher: fs.FSWatcher | null = null;
    private filePath: string | null = null;
    private byteOffset = 0;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private debounceMs = defaultDebounceMs;
    private disposed = false;
    /** Tracks emitted tool calls to prevent streaming duplicates during tailing. */
    private seenToolKeys = new Set<string>();

    constructor(private readonly outputChannel: vscode.OutputChannel) {}

    /**
     * Start watching for the given workspace path.
     * Performs a lookback scan, then begins tailing the JSONL file.
     */
    async start(workspacePath: string, options: AiWatcherOptions): Promise<void> {
        this.stop();
        const session = await resolveActiveSession(workspacePath);
        if (!session) { return; }

        this.filePath = session.filePath;
        this.debounceMs = options.debounceMs ?? defaultDebounceMs;
        this.outputChannel.appendLine(`[AI] Watching ${session.filePath}`);

        await this.performLookback(options.lookbackMs);
        this.startFsWatcher();
    }

    /** Stop watching and release resources. */
    stop(): void {
        if (this.watcher) { this.watcher.close(); this.watcher = null; }
        if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
        this.filePath = null;
        this.byteOffset = 0;
        this.seenToolKeys.clear();
    }

    dispose(): void {
        this.disposed = true;
        this.stop();
        this._onEntries.dispose();
    }

    /** Read the tail of the file to find recent activity within the lookback window. */
    private async performLookback(lookbackMs: number): Promise<void> {
        if (!this.filePath) { return; }
        const cutoff = new Date(Date.now() - lookbackMs);
        let stat: fs.Stats;
        try { stat = await fs.promises.stat(this.filePath); }
        catch { return; }

        const fileSize = stat.size;
        const readStart = Math.max(0, fileSize - lookbackBytes);
        const chunk = await this.readRange(readStart, fileSize);
        if (!chunk) { return; }

        // Skip partial first line if we didn't start at byte 0
        const text = readStart > 0 ? chunk.substring(chunk.indexOf('\n') + 1) : chunk;
        const entries = parseJsonlChunk(text).filter(e => e.timestamp >= cutoff);

        // Seed dedup set so tailing doesn't re-emit lookback entries
        for (const e of entries) { this.trackEntry(e); }
        this.byteOffset = fileSize;
        if (entries.length > 0) {
            this.outputChannel.appendLine(`[AI] Lookback found ${entries.length} entries`);
            this._onEntries.fire(entries);
        }
    }

    private startFsWatcher(): void {
        if (!this.filePath || this.disposed) { return; }
        try {
            this.watcher = fs.watch(this.filePath, () => this.onFileChange());
        } catch (err) {
            this.outputChannel.appendLine(`[AI] Watch failed: ${err}`);
        }
    }

    private onFileChange(): void {
        if (this.debounceTimer) { return; }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.readNewBytes().catch(err => {
                this.outputChannel.appendLine(`[AI] Read error: ${err}`);
            });
        }, this.debounceMs);
    }

    private async readNewBytes(): Promise<void> {
        if (!this.filePath || this.disposed) { return; }
        let stat: fs.Stats;
        try { stat = await fs.promises.stat(this.filePath); }
        catch { return; }

        if (stat.size <= this.byteOffset) {
            // File shrank (rotation) — reset to start
            if (stat.size < this.byteOffset) { this.byteOffset = 0; }
            return;
        }
        const chunk = await this.readRange(this.byteOffset, stat.size);
        this.byteOffset = stat.size;
        if (!chunk) { return; }
        const fresh = parseJsonlChunk(chunk).filter(e => this.isNewEntry(e));
        if (fresh.length > 0) { this._onEntries.fire(fresh); }
    }

    /** Build a dedup key for tool-call entries: messageId:toolName:filePath. */
    private toolKey(e: AiActivityEntry): string | null {
        if (e.type !== 'tool-call' || !e.toolCall) { return null; }
        return `${e.messageId ?? ''}:${e.toolCall.toolName}:${e.toolCall.filePath ?? ''}`;
    }

    /** Track an entry in the dedup set. */
    private trackEntry(e: AiActivityEntry): void {
        const key = this.toolKey(e);
        if (key) { this.seenToolKeys.add(key); }
    }

    /** Returns true if the entry hasn't been emitted before (and tracks it). */
    private isNewEntry(e: AiActivityEntry): boolean {
        const key = this.toolKey(e);
        if (!key) { return true; } // Non-tool entries always pass through
        if (this.seenToolKeys.has(key)) { return false; }
        this.seenToolKeys.add(key);
        return true;
    }

    private async readRange(start: number, end: number): Promise<string | null> {
        if (!this.filePath || start >= end) { return null; }
        return new Promise<string | null>((resolve) => {
            const chunks: Buffer[] = [];
            const stream = fs.createReadStream(this.filePath!, {
                start, end: end - 1, encoding: undefined,
            });
            stream.on('data', (data: Buffer | string) => chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            stream.on('error', () => resolve(null));
        });
    }
}
