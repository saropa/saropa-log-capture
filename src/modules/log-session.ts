import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SaropaLogCaptureConfig } from './config';
import { Deduplicator } from './deduplication';
import { FileSplitter, SplitReason, formatSplitReason } from './file-splitter';
import {
    SessionContext,
    SourceLocation,
    generateBaseFileName,
    formatLine,
    generateContinuationHeader,
    generateContextHeader,
} from './log-session-helpers';
export { SessionContext };

export type SessionState = 'recording' | 'paused' | 'stopped';

export type LineCountCallback = (count: number) => void;

/** Callback for when a split occurs. */
export type SplitCallback = (newUri: vscode.Uri, partNumber: number, reason: SplitReason) => void;

export class LogSession {
    private _state: SessionState = 'recording';
    private _lineCount = 0;
    private _fileUri: vscode.Uri | undefined;
    private writeStream: fs.WriteStream | undefined;
    private maxLinesReached = false;
    private readonly deduplicator: Deduplicator;
    private readonly splitter: FileSplitter;

    // Split tracking
    private _partNumber = 0;
    private _bytesWritten = 0;
    private _partStartTime = Date.now();
    private _lastLineTime = 0;
    private _previousTimestamp: Date | undefined;
    private _baseFileName = '';
    private onSplit?: SplitCallback;

    get state(): SessionState { return this._state; }
    get lineCount(): number { return this._lineCount; }
    get fileUri(): vscode.Uri { return this._fileUri!; }
    get partNumber(): number { return this._partNumber; }
    get bytesWritten(): number { return this._bytesWritten; }
    get startTime(): number { return this._partStartTime; }

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

    async start(): Promise<void> {
        const logDirUri = this.getLogDirUri();
        const logDirPath = logDirUri.fsPath;

        await fs.promises.mkdir(logDirPath, { recursive: true });

        // Generate base filename (without part suffix)
        this._baseFileName = generateBaseFileName(this.context.projectName, this.context.date);
        const fileName = this.getPartFileName();
        const filePath = path.join(logDirPath, fileName);
        this._fileUri = vscode.Uri.file(filePath);

        this.writeStream = fs.createWriteStream(filePath, {
            flags: 'a',
            encoding: 'utf-8',
        });

        const header = generateContextHeader(this.context, this.config);
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
        if (this._state !== 'recording' || this.maxLinesReached || !this.writeStream) {
            return;
        }

        // Check split conditions before writing
        const splitResult = this.splitter.evaluate({
            lineCount: this._lineCount,
            bytesWritten: this._bytesWritten,
            startTime: this._partStartTime,
            lastLineTime: this._lastLineTime,
        }, text);

        if (splitResult.shouldSplit && splitResult.reason) {
            this.performSplit(splitResult.reason).catch(() => {});
        }

        const elapsedMs = this.computeElapsed(timestamp);
        const formatted = formatLine(text, category, {
            timestamp,
            includeTimestamp: this.config.includeTimestamp,
            sourceLocation,
            includeSourceLocation: this.config.includeSourceLocation,
            elapsedMs,
            includeElapsedTime: this.config.includeElapsedTime,
        });
        this._previousTimestamp = timestamp;
        const lines = this.deduplicator.process(formatted);

        for (const line of lines) {
            if (this._lineCount >= this.config.maxLines) {
                this.maxLinesReached = true;
                this.writeStream.write(`\n--- MAX LINES REACHED (${this.config.maxLines}) ---\n`);
                return;
            }
            const lineData = line + '\n';
            this.writeStream.write(lineData);
            this._bytesWritten += Buffer.byteLength(lineData, 'utf-8');
            this._lineCount++;
        }

        this._lastLineTime = Date.now();
        this.onLineCountChanged(this._lineCount);
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

        this.writeStream.write(markerLine + '\n');
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
        if (this._state !== 'recording' || !this.writeStream) {
            return;
        }
        const lineData = formatted + '\n';
        this.writeStream.write(lineData);
        this._bytesWritten += Buffer.byteLength(lineData, 'utf-8');
    }

    /** Manually trigger a file split. */
    async splitNow(): Promise<void> {
        if (this._state === 'stopped' || !this.writeStream) {
            return;
        }
        await this.performSplit({ type: 'manual' });
    }

    /** Perform a file split - close current file, open new one. */
    private async performSplit(reason: SplitReason): Promise<void> {
        if (!this.writeStream) {
            return;
        }

        // Write split marker to current file
        const splitMarker = `\n=== SPLIT: ${formatSplitReason(reason)} — Continued in part ${this._partNumber + 2} ===\n`;
        this.writeStream.write(splitMarker);

        // Close current file
        await new Promise<void>((resolve, reject) => {
            this.writeStream!.end(() => resolve());
            this.writeStream!.on('error', reject);
        });

        // Increment part number and reset counters
        this._partNumber++;
        this._bytesWritten = 0;
        this._partStartTime = Date.now();
        this._lastLineTime = 0;

        // Open new file
        const logDirPath = this.getLogDirUri().fsPath;
        const newFileName = this.getPartFileName();
        const newFilePath = path.join(logDirPath, newFileName);
        this._fileUri = vscode.Uri.file(newFilePath);

        this.writeStream = fs.createWriteStream(newFilePath, {
            flags: 'a',
            encoding: 'utf-8',
        });

        // Write continuation header
        const header = generateContinuationHeader(
            this.context,
            this._partNumber,
            reason,
            this._baseFileName
        );
        this.writeStream.write(header);
        this._bytesWritten = Buffer.byteLength(header, 'utf-8');

        // Notify callback
        this.onSplit?.(this._fileUri, this._partNumber, reason);
    }

    /** Get the filename for the current part. */
    private getPartFileName(): string {
        if (this._partNumber === 0) {
            return `${this._baseFileName}.log`;
        }
        const partSuffix = String(this._partNumber + 1).padStart(3, '0');
        return `${this._baseFileName}_${partSuffix}.log`;
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
        this._state = 'stopped';

        // Flush deduplication buffer.
        if (this.writeStream) {
            const flushed = this.deduplicator.flush();
            for (const line of flushed) {
                this.writeStream.write(line + '\n');
                this._lineCount++;
            }

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
        this.maxLinesReached = false;
        this._previousTimestamp = undefined;
        this.deduplicator.reset();
        this.onLineCountChanged(0);
    }

    /** Compute elapsed ms since previous line. */
    private computeElapsed(current: Date): number | undefined {
        if (!this.config.includeElapsedTime || !this._previousTimestamp) {
            return undefined;
        }
        return current.getTime() - this._previousTimestamp.getTime();
    }

    private getLogDirUri(): vscode.Uri {
        if (path.isAbsolute(this.config.logDirectory)) {
            return vscode.Uri.file(this.config.logDirectory);
        }
        return vscode.Uri.joinPath(this.context.workspaceFolder.uri, this.config.logDirectory);
    }
}

