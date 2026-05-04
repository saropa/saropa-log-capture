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
    /** Buffered appends while split is in progress; ensures newest lines are never dropped. */
    private readonly pendingLines: Array<{
        readonly text: string;
        readonly category: string;
        readonly timestamp: Date;
        readonly sourceLocation?: SourceLocation;
    }> = [];
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
        this.pendingLines.push({ text, category, timestamp, sourceLocation });
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
                if (this._state !== 'recording' || !this.writeStream) {
                    return;
                }
                const next = this.pendingLines[0];
                await this.splitBeforeNextLineIfNeeded(next.text);

                const elapsedMs = computeElapsedMs(this.config.includeElapsedTime, this._previousTimestamp, next.timestamp);
                const formatted = formatLine(next.text, next.category, {
                    timestamp: next.timestamp,
                    includeTimestamp: this.config.includeTimestamp,
                    sourceLocation: next.sourceLocation,
                    includeSourceLocation: this.config.includeSourceLocation,
                    elapsedMs,
                    includeElapsedTime: this.config.includeElapsedTime,
                });
                this._previousTimestamp = next.timestamp;
                /* Capture-side deduplication is intentionally bypassed: the
                   2026.04 unified-line-collapsing rethink moved every collapse/hide
                   to the viewer layer so line numbers in the captured file match
                   the app's actual output 1:1. Each incoming line is written as
                   its own row; identical-within-500ms runs that the old
                   Deduplicator would have folded to `(xN)` suffix are now folded
                   visually in the viewer via the inline .dedup-badge ("×N" pill)
                   on the survivor row (see bugs/048_plan-severity-gutter-decoupling.md
                   for the current viewer-side affordance) and preserve per-line
                   timestamps in the file. */
                await this.writeProcessedLines([formatted]);
                this.pendingLines.shift();

                this._lastLineTime = Date.now();
                this._lastWriteTime = this._lastLineTime;
                this.onLineCountChanged(this._lineCount);
            }
        } finally {
            this.processingQueue = false;
        }
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
        if (this._state === 'stopped' || !this.writeStream || this.splitting) {
            return undefined;
        }

        const now = new Date();
        const ts = now.toLocaleTimeString();
        const label = customText ? `${ts} — ${customText}` : ts;
        const markerLine = `\n--- MARKER: ${label} ---\n`;

        this.writeStream.write(markerLine + '\n');
        this._lastWriteTime = Date.now();
        this._lineCount++;
        this.onLineCountChanged(this._lineCount);
        return markerLine.trim();
    }

    /**
     * Append a pre-formatted DAP protocol line to the log file.
     * Bypasses deduplication and does not increment _lineCount
     * (DAP lines are diagnostic infrastructure, not user output).
     */
    appendDapLine(formatted: string): void {
        if (this._state !== 'recording' || !this.writeStream || this.splitting) {
            return;
        }
        const lineData = formatted + '\n';
        this.writeStream.write(lineData);
        this._bytesWritten += Buffer.byteLength(lineData, 'utf-8');
    }

    /**
     * Append extra header lines (e.g. from async build/CI). Call only while recording.
     * Does not increment _lineCount; used for late-arriving integration header data.
     */
    appendHeaderLines(lines: readonly string[]): void {
        if (this._state !== 'recording' || !this.writeStream || this.splitting || lines.length === 0) {
            return;
        }
        const block = '\n' + lines.join('\n') + '\n';
        this.writeStream.write(block);
        this._bytesWritten += Buffer.byteLength(block, 'utf-8');
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

            await new Promise<void>((resolve, reject) => {
                this.writeStream!.end(() => resolve());
                this.writeStream!.on('error', reject);
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

