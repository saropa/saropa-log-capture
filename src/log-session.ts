import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SaropaLogCaptureConfig, shouldRedactEnvVar } from './config';
import { Deduplicator } from './deduplication';

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

export class LogSession {
    private _state: SessionState = 'recording';
    private _lineCount = 0;
    private _fileUri: vscode.Uri | undefined;
    private writeStream: fs.WriteStream | undefined;
    private maxLinesReached = false;
    private readonly deduplicator: Deduplicator;

    get state(): SessionState {
        return this._state;
    }

    get lineCount(): number {
        return this._lineCount;
    }

    get fileUri(): vscode.Uri {
        return this._fileUri!;
    }

    constructor(
        private readonly context: SessionContext,
        private readonly config: SaropaLogCaptureConfig,
        private readonly onLineCountChanged: LineCountCallback
    ) {
        this.deduplicator = new Deduplicator();
    }

    async start(): Promise<void> {
        const logDirUri = this.getLogDirUri();
        const logDirPath = logDirUri.fsPath;

        await fs.promises.mkdir(logDirPath, { recursive: true });

        const fileName = generateFileName(this.context.projectName, this.context.date);
        const filePath = path.join(logDirPath, fileName);
        this._fileUri = vscode.Uri.file(filePath);

        this.writeStream = fs.createWriteStream(filePath, {
            flags: 'a',
            encoding: 'utf-8',
        });

        const header = generateContextHeader(this.context, this.config);
        this.writeStream.write(header);
    }

    appendLine(text: string, category: string, timestamp: Date): void {
        if (this._state !== 'recording' || this.maxLinesReached || !this.writeStream) {
            return;
        }

        const formatted = formatLine(text, category, timestamp, this.config.includeTimestamp);
        const lines = this.deduplicator.process(formatted);

        for (const line of lines) {
            if (this._lineCount >= this.config.maxLines) {
                this.maxLinesReached = true;
                this.writeStream.write(`\n--- MAX LINES REACHED (${this.config.maxLines}) ---\n`);
                return;
            }
            this.writeStream.write(line + '\n');
            this._lineCount++;
        }

        this.onLineCountChanged(this._lineCount);
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

function generateFileName(projectName: string, date: Date): string {
    const dateStr = date.toISOString().slice(0, 10);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safeName}_${dateStr}_${hours}-${minutes}.log`;
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
