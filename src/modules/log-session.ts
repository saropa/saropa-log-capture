import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SaropaLogCaptureConfig, shouldRedactEnvVar } from './config';
import { Deduplicator } from './deduplication';
import { FileSplitter, SplitReason, formatSplitReason } from './file-splitter';

export interface SessionContext {
    readonly date: Date;
    readonly projectName: string;
    readonly debugAdapterType: string;
    readonly configurationName: string;
    readonly configuration: vscode.DebugConfiguration;
    readonly vscodeVersion: string;
    readonly extensionVersion: string;
    readonly os: string;
    readonly workspaceFolder: vscode.WorkspaceFolder;
}

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
    private _baseFileName = '';
    private onSplit?: SplitCallback;

    get state(): SessionState {
        return this._state;
    }

    get lineCount(): number {
        return this._lineCount;
    }

    get fileUri(): vscode.Uri {
        return this._fileUri!;
    }

    get partNumber(): number {
        return this._partNumber;
    }

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

    appendLine(text: string, category: string, timestamp: Date): void {
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

        const formatted = formatLine(text, category, timestamp, this.config.includeTimestamp);
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
        this.deduplicator.reset();
        this.onLineCountChanged(0);
    }

    private getLogDirUri(): vscode.Uri {
        if (path.isAbsolute(this.config.logDirectory)) {
            return vscode.Uri.file(this.config.logDirectory);
        }
        return vscode.Uri.joinPath(this.context.workspaceFolder.uri, this.config.logDirectory);
    }
}

/** Generate base filename without .log extension (for split naming). */
function generateBaseFileName(projectName: string, date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${y}${mo}${d}_${h}-${mi}_${safeName}`;
}

function formatLine(
    text: string,
    category: string,
    timestamp: Date,
    includeTimestamp: boolean
): string {
    if (!includeTimestamp) {
        return `[${category}] ${text}`;
    }
    const ts =
        timestamp.toTimeString().slice(0, 8) +
        '.' +
        String(timestamp.getMilliseconds()).padStart(3, '0');
    return `[${ts}] [${category}] ${text}`;
}

function generateContinuationHeader(
    ctx: SessionContext,
    partNumber: number,
    reason: SplitReason,
    baseFileName: string
): string {
    const lines: string[] = [];
    lines.push(`=== SAROPA LOG CAPTURE — PART ${partNumber + 1} ===`);
    lines.push(`Continuation of: ${baseFileName}.log`);
    lines.push(`Split reason:    ${formatSplitReason(reason)}`);
    lines.push(`Date:            ${new Date().toISOString()}`);
    lines.push(`Project:         ${ctx.projectName}`);
    lines.push('==========================================');
    lines.push('');
    return lines.join('\n') + '\n';
}

function generateContextHeader(
    ctx: SessionContext,
    config: SaropaLogCaptureConfig
): string {
    const lines: string[] = [];
    lines.push('=== SAROPA LOG CAPTURE — SESSION START ===');
    lines.push(`Date:           ${ctx.date.toISOString()}`);
    lines.push(`Project:        ${ctx.projectName}`);
    lines.push(`Debug Adapter:  ${ctx.debugAdapterType}`);
    lines.push(`launch.json:    ${ctx.configurationName}`);

    // Dump relevant launch config properties.
    const { type: _type, name: _name, request: _request, ...rest } = ctx.configuration;
    for (const [key, value] of Object.entries(rest)) {
        const padding = ' '.repeat(Math.max(1, 14 - key.length));
        if (key === 'env' && typeof value === 'object' && value !== null) {
            const redacted = redactEnv(
                value as Record<string, string>,
                config.redactEnvVars
            );
            lines.push(`  ${key}:${padding}${JSON.stringify(redacted)}`);
        } else {
            lines.push(`  ${key}:${padding}${JSON.stringify(value)}`);
        }
    }

    lines.push(`VS Code:        ${ctx.vscodeVersion}`);
    lines.push(`Extension:      saropa-log-capture v${ctx.extensionVersion}`);
    lines.push(`OS:             ${ctx.os}`);
    lines.push('==========================================');
    lines.push('');
    return lines.join('\n') + '\n';
}

function redactEnv(
    env: Record<string, string>,
    patterns: readonly string[]
): Record<string, string> {
    if (patterns.length === 0) {
        return env;
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        result[key] = shouldRedactEnvVar(key, patterns) ? '***REDACTED***' : value;
    }
    return result;
}
