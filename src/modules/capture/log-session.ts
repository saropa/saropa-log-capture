/**
 * Writes debug output to a log file. Created by session-lifecycle.initializeSession;
 * receives lines from SessionManager (DAP → tracker → SessionManager → appendLine).
 * Handles file splitting, deduplication, max lines, and markers.
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SaropaLogCaptureConfig } from '../config/config';
import { Deduplicator } from './deduplication';
import { FileSplitter, SplitReason } from '../misc/file-splitter';
import {
    SessionContext,
    SourceLocation,
    generateBaseFileName,
    formatLine,
    generateContextHeader,
    getLogDirUri,
    computeElapsed as computeElapsedMs,
} from './log-session-helpers';
import { getPartFileName, performFileSplit } from './log-session-split';
import { logExtensionError } from '../misc/extension-logger';
export type { SessionContext } from './log-session-helpers';

export type SessionState = 'recording' | 'paused' | 'stopped';

export type LineCountCallback = (count: number) => void;

/** Callback for when a split occurs. */
export type SplitCallback = (newUri: vscode.Uri, partNumber: number, reason: SplitReason) => void;

export class LogSession {
    private _state: SessionState = 'recording';
    private _lineCount = 0;
    private _fileUri: vscode.Uri | undefined;
    private writeStream: fs.WriteStream | undefined;
    /** Guard flag — prevents writes to a stream being closed during split. */
    private splitting = false;
    /** Guard flag — prevents concurrent queue processors. */
    private processingQueue = false;
    /**
     * Single ordered write queue. Captured lines AND infrastructure writes (markers, DAP, header
     * lines) all flow through this so they can never interleave mid-write or bypass split accounting.
     * 'line' items are formatted + counted; 'raw' items are pre-formatted blocks (`countsAsLine`
     * decides whether they advance the line count — markers do, DAP/header don't).
     */
    private readonly pendingLines: Array<
        | { readonly kind: 'line'; readonly text: string; readonly category: string; readonly timestamp: Date; readonly sourceLocation?: SourceLocation }
        | { readonly kind: 'raw'; readonly block: string; readonly countsAsLine: boolean }
    > = [];
    private readonly deduplicator: Deduplicator;
    private readonly splitter: FileSplitter;

    // Split tracking
    private _partNumber = 0;
    private _bytesWritten = 0;
    private _partStartTime = Date.now();
    private _lastLineTime = 0;
    private _lastWriteTime = 0;
    private _previousTimestamp: Date | undefined;
    private _baseFileName = '';
    private onSplit?: SplitCallback;

    get state(): SessionState { return this._state; }
    get lineCount(): number { return this._lineCount; }
    get fileUri(): vscode.Uri { return this._fileUri!; }
    get partNumber(): number { return this._partNumber; }
    get bytesWritten(): number { return this._bytesWritten; }
    get startTime(): number { return this._partStartTime; }
    /** Time (ms since epoch) of last write to this session (for "recent updates" UI). */
    get lastWriteTime(): number { return this._lastWriteTime; }
    /** Session context (for integration API). */
    get sessionContext(): SessionContext { return this.context; }

    constructor(
        private readonly context: SessionContext,
        private readonly config: SaropaLogCaptureConfig,
        private readonly onLineCountChanged: LineCountCallback
    ) {
        this.deduplicator = new Deduplicator();
        this.splitter = new FileSplitter(config.splitRules);
    }

    /** Set a callback for when the file splits. */
    setSplitCallback(callback: SplitCallback): void {
        this.onSplit = callback;
    }

    /**
     * Attach a permanent `'error'` listener to a write stream.
     *
     * A Node stream that emits `'error'` with NO listener throws an uncaught exception that takes
     * down the extension host — so disk-full, a revoked permission, or the file being deleted by an
     * external tool mid-capture would crash the whole pipeline instead of degrading. The file on disk
     * is append-only and never truncated, so everything written before the failure survives; here we
     * just log and drop the stream so subsequent appends no-op (appendLine guards on `!writeStream`)
     * rather than throw. Must be attached to every stream the moment it is created.
     */
    private attachStreamErrorHandler(stream: fs.WriteStream): void {
        stream.on('error', (err) => {
            logExtensionError('logSession.writeStream', err);
            if (this.writeStream === stream) { this.writeStream = undefined; }
        });
    }

    /**
     * Write to `stream` honoring backpressure.
     *
     * When the OS write buffer is full, `write()` returns `false`. The append queue here is strictly
     * serialized (one `processPendingLines` loop at a time), so without awaiting `'drain'` a fast
     * producer on a slow disk keeps calling `write()` and Node grows its internal buffer without
     * bound — memory pressure that can spike the extension host on a large, sustained log burst.
     * Awaiting `'drain'` paces the queue to actual disk throughput. (This is throughput/memory
     * hygiene, not data loss — Node still buffers and eventually flushes; the crash-on-error path is
     * handled separately by the permanent `'error'` listener.)
     *
     * Resolve on `'error'`/`'close'` as well as `'drain'`: if the stream dies mid-await (disk full,
     * file removed by an external tool), `'drain'` will never fire, so waiting only on it would hang
     * the queue forever. The permanent error handler has already logged and nulled the stream by then,
     * and every append guards on a missing stream, so resolving early here is safe.
     */
    private async writeBackpressured(stream: fs.WriteStream, data: string): Promise<void> {
        if (stream.write(data)) { return; }
        await new Promise<void>((resolve) => {
            const done = (): void => {
                stream.removeListener('drain', done);
                stream.removeListener('error', done);
                stream.removeListener('close', done);
                resolve();
            };
            stream.on('drain', done);
            stream.on('error', done);
            stream.on('close', done);
        });
    }

    /** Create log directory, open first part file, write context header (and optional integration header lines). */
    async start(extraHeaderLines?: readonly string[]): Promise<void> {
        const logDirUri = getLogDirUri(this.context, this.config);
        const logDirPath = logDirUri.fsPath;

        await fs.promises.mkdir(logDirPath, { recursive: true });

        // Generate base filename (without part suffix)
        this._baseFileName = generateBaseFileName(this.context.projectName, this.context.date);
        const fileName = getPartFileName(this._baseFileName, this._partNumber);
        const filePath = path.join(logDirPath, fileName);
        this._fileUri = vscode.Uri.file(filePath);

        this.writeStream = fs.createWriteStream(filePath, {
            flags: 'a',
            encoding: 'utf-8',
        });
        this.attachStreamErrorHandler(this.writeStream);

        const header = generateContextHeader(this.context, this.config, extraHeaderLines);
        this.writeStream.write(header);
        this._bytesWritten = Buffer.byteLength(header, 'utf-8');
        this._partStartTime = Date.now();
    }

    appendLine(
        text: string,
        category: string,
        timestamp: Date,
        sourceLocation?: SourceLocation,
    ): void {
        if (this._state !== 'recording' || !this.writeStream) {
            return;
        }
        this.pendingLines.push({ kind: 'line', text, category, timestamp, sourceLocation });
        this.processPendingLines().catch((e) => { console.error('Log append queue failed:', e); });
    }

    /** Process append queue in strict order and split before writes when needed. */
    private async processPendingLines(): Promise<void> {
        if (this.processingQueue) {
            return;
        }
        this.processingQueue = true;
        try {
            while (this.pendingLines.length > 0) {
                if (!this.writeStream) { return; }
                const next = this.pendingLines[0];
                // Captured lines only flow while recording; if paused, leave them (and anything
                // queued behind) until resume. Raw items (markers/header) still flush while paused,
                // matching the pre-queue behavior where a marker could be inserted while paused.
                if (next.kind === 'line' && this._state !== 'recording') { return; }
                if (next.kind === 'line') {
                    await this.writeQueuedLine(next);
                } else {
                    await this.writeQueuedRaw(next);
                }
                this.pendingLines.shift();
                this._lastWriteTime = Date.now();
                if (next.kind === 'line' || next.countsAsLine) { this._lastLineTime = this._lastWriteTime; }
                this.onLineCountChanged(this._lineCount);
            }
        } finally {
            this.processingQueue = false;
        }
    }

    /** Format and write one queued captured line (split-accounted, counted). */
    private async writeQueuedLine(
        item: { text: string; category: string; timestamp: Date; sourceLocation?: SourceLocation },
    ): Promise<void> {
        await this.splitBeforeNextLineIfNeeded(item.text);
        const elapsedMs = computeElapsedMs(this.config.includeElapsedTime, this._previousTimestamp, item.timestamp);
        const formatted = formatLine(item.text, item.category, {
            timestamp: item.timestamp,
            includeTimestamp: this.config.includeTimestamp,
            sourceLocation: item.sourceLocation,
            includeSourceLocation: this.config.includeSourceLocation,
            elapsedMs,
            includeElapsedTime: this.config.includeElapsedTime,
        });
        this._previousTimestamp = item.timestamp;
        // Capture-side dedup intentionally bypassed (2026.04 unified-line-collapsing rethink — the
        // viewer folds visually); each line is written 1:1 so file line numbers match the app output.
        await this.writeProcessedLines([formatted]);
    }

    /** Write one pre-formatted block (marker / DAP / header) in queue order, split-accounted by size. */
    private async writeQueuedRaw(item: { block: string; countsAsLine: boolean }): Promise<void> {
        // Split before writing so a marker can't push a part past its limits (the old direct-write
        // path skipped this); the block doubles as the "next text" for the byte-size split check.
        await this.splitBeforeNextLineIfNeeded(item.block);
        if (!this.writeStream) { return; }
        this.writeStream.write(item.block);
        this._bytesWritten += Buffer.byteLength(item.block, 'utf-8');
        if (item.countsAsLine) { this._lineCount++; }
    }

    /** Wait until buffered appendLine calls are flushed to disk. */
    private async drainPendingLines(): Promise<void> {
        while (this.pendingLines.length > 0 || this.processingQueue) {
            if (!this.processingQueue && this.pendingLines.length > 0) {
                await this.processPendingLines();
                continue;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }

    /** Rotate part when max line threshold or explicit split rules are reached. */
    private async splitBeforeNextLineIfNeeded(nextText: string): Promise<void> {
        if (!this.writeStream) {
            return;
        }
        if (this.config.maxLines > 0 && this._lineCount >= this.config.maxLines) {
            await this.performSplit({ type: 'lines', count: this._lineCount });
        }
        const splitResult = this.splitter.evaluate({
            lineCount: this._lineCount,
            bytesWritten: this._bytesWritten,
            startTime: this._partStartTime,
            lastLineTime: this._lastLineTime,
        }, nextText);
        if (splitResult.shouldSplit && splitResult.reason) {
            await this.performSplit(splitResult.reason);
        }
    }

    /** Write deduplicated lines and rotate mid-batch instead of dropping newest output. */
    private async writeProcessedLines(lines: readonly string[]): Promise<void> {
        for (const line of lines) {
            if (!this.writeStream) {
                return;
            }
            if (this.config.maxLines > 0 && this._lineCount >= this.config.maxLines) {
                await this.performSplit({ type: 'lines', count: this._lineCount });
            }
            if (!this.writeStream) {
                return;
            }
            const lineData = line + '\n';
            this.writeStream.write(lineData);
            this._bytesWritten += Buffer.byteLength(lineData, 'utf-8');
            this._lineCount++;
        }
    }

    /**
     * Insert a visual marker/separator into the log file.
     * Bypasses deduplication — markers should never be grouped.
     * @returns The marker text written, or undefined if not recording.
     */
    appendMarker(customText?: string): string | undefined {
        if (this._state === 'stopped' || !this.writeStream) {
            return undefined;
        }

        const now = new Date();
        const ts = now.toLocaleTimeString();
        const label = customText ? `${ts} — ${customText}` : ts;
        const markerLine = `\n--- MARKER: ${label} ---\n`;

        // Enqueue rather than write directly so the marker can't interleave with queued lines or skip
        // split accounting. The text is returned synchronously for the caller's viewer broadcast; the
        // file write and line-count bump happen when the queue reaches this entry.
        this.pendingLines.push({ kind: 'raw', block: markerLine + '\n', countsAsLine: true });
        this.processPendingLines().catch((e) => { console.error('Log append queue failed:', e); });
        return markerLine.trim();
    }

    /**
     * Append a pre-formatted DAP protocol line to the log file.
     * Bypasses deduplication and does not increment _lineCount
     * (DAP lines are diagnostic infrastructure, not user output).
     */
    appendDapLine(formatted: string): void {
        if (this._state !== 'recording' || !this.writeStream) {
            return;
        }
        // Enqueue so DAP lines stay ordered with captured output (does not advance the line count).
        this.pendingLines.push({ kind: 'raw', block: formatted + '\n', countsAsLine: false });
        this.processPendingLines().catch((e) => { console.error('Log append queue failed:', e); });
    }

    /**
     * Append extra header lines (e.g. from async build/CI). Call only while recording.
     * Does not increment _lineCount; used for late-arriving integration header data.
     */
    appendHeaderLines(lines: readonly string[]): void {
        if (this._state !== 'recording' || !this.writeStream || lines.length === 0) {
            return;
        }
        // Enqueue so late integration header lines stay ordered with captured output (not counted).
        const block = '\n' + lines.join('\n') + '\n';
        this.pendingLines.push({ kind: 'raw', block, countsAsLine: false });
        this.processPendingLines().catch((e) => { console.error('Log append queue failed:', e); });
    }

    /** Manually trigger a file split. */
    async splitNow(): Promise<void> {
        if (this._state === 'stopped' || !this.writeStream) {
            return;
        }
        await this.performSplit({ type: 'manual' });
    }

    /** Perform a file split: close current stream, open new part file, notify listeners. */
    private async performSplit(reason: SplitReason): Promise<void> {
        if (!this.writeStream || this.splitting) {
            return;
        }

        this.splitting = true;
        try {
            const result = await performFileSplit({
                writeStream: this.writeStream,
                logDirPath: getLogDirUri(this.context, this.config).fsPath,
                baseFileName: this._baseFileName,
                partNumber: this._partNumber,
                context: this.context,
            }, reason);

            this.writeStream = result.newStream;
            // Re-arm crash protection on the freshly opened part. The new stream's writes (including
            // the continuation header written inside performFileSplit) emit 'error' asynchronously,
            // so attaching here — synchronously after the await resolves — wins the race.
            this.attachStreamErrorHandler(this.writeStream);
            this._fileUri = result.newFileUri;
            this._partNumber = result.newPartNumber;
            this._bytesWritten = result.headerBytes;
            this._partStartTime = Date.now();
            this._lastLineTime = 0;
        } finally {
            this.splitting = false;
        }

        this.onSplit?.(this._fileUri, this._partNumber, reason);
    }

    pause(): void {
        if (this._state === 'recording') {
            this._state = 'paused';
        }
    }

    resume(): void {
        if (this._state === 'paused') {
            this._state = 'recording';
        }
    }

    async stop(): Promise<void> {
        if (this._state === 'stopped') {
            return;
        }

        // Preserve newest output by flushing any queued appendLine calls before closing.
        await this.drainPendingLines();
        this._state = 'stopped';

        // Capture-side deduplication bypassed — no pending fold buffer to flush.
        // (See the drainPendingLines comment for the "every raw line is written"
        //  rationale.) Kept calling deduplicator.flush() for defensive state
        // reset in case a future code path resurfaces capture-side folding.
        if (this.writeStream) {
            this.deduplicator.flush(); /* no-op under bypass; discards any state. */

            const footer = `\n=== SESSION END — ${new Date().toISOString()} — ${this._lineCount} lines ===\n`;
            this.writeStream.write(footer);

            // Resolve on end OR error: the permanent error handler already logged/dropped the stream,
            // so a final-flush failure must still let stop() complete rather than reject and leave the
            // session finalize path hanging. `once` avoids leaking the listener on the happy path.
            await new Promise<void>((resolve) => {
                this.writeStream!.once('error', () => resolve());
                this.writeStream!.end(() => resolve());
            });
        }

        this.onLineCountChanged(this._lineCount);
    }

    clear(): void {
        this._lineCount = 0;
        this._previousTimestamp = undefined;
        this.pendingLines.length = 0;
        this.deduplicator.reset();
        this.onLineCountChanged(0);
    }

}

