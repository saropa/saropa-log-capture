/**
 * Helper functions and types for LogSession.
 *
 * Contains the SessionContext interface and pure functions for
 * filename generation, line formatting, and context header creation.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { SaropaLogCaptureConfig, shouldRedactEnvVar } from '../config/config';
import { SplitReason, formatSplitReason } from '../misc/file-splitter';
import type { DevEnvironment } from '../misc/environment-collector';

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
    readonly devEnvironment?: DevEnvironment;
}

/**
 * True when a candidate workspace folder matches a session's recorded workspace folder.
 * Bug 034 fix: in multi-root workspaces, output routing must not fall back to matching
 * purely on timing — it has to confirm the debug adapter's folder is the same one the
 * LogSession was opened for, or output from folder B silently lands in folder A's file.
 * When `candidate` is undefined (the debug session reported no workspace folder, e.g. an
 * attach-only launch) we cannot rule the session out, so we fail open and allow the match —
 * this preserves existing single-root behavior where `workspaceFolder` is not always set.
 */
export function workspaceFolderMatches(
    sessionWorkspaceFolder: vscode.WorkspaceFolder,
    candidate: vscode.WorkspaceFolder | undefined,
): boolean {
    if (!candidate) { return true; }
    return sessionWorkspaceFolder.uri.fsPath === candidate.uri.fsPath;
}

/** Format a date as yyyymmdd for use as a subfolder name. */
export function formatDateFolder(date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${mo}${d}`;
}

/** Generate base filename without .log extension (for split naming). */
export function generateBaseFileName(projectName: string, date: Date): string {
    const dateStr = formatDateFolder(date);
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${dateStr}_${h}${mi}${s}_${safeName}`;
}

/** Source location from a DAP output event. */
export interface SourceLocation {
    readonly path?: string;
    readonly line?: number;
    readonly column?: number;
}

/**
 * Where a queued block actually landed in its part file, reported from inside `LogSession`'s
 * append queue once the write happens.
 *
 * Nothing outside the queue can work this out. `appendLine`/`appendMarker` only ENQUEUE, so a
 * caller reading `partNumber`/`physicalLineCount` at enqueue time gets a position short by the
 * whole queue backlog — and naming the wrong part entirely if the queue splits the file before
 * the block lands. Both numbers are needed because the two consumers ask different questions:
 * a boundary ("what came before this?") and a line number ("which line is this?").
 */
export interface WritePosition {
    readonly partNumber: number;
    /** Physical line count of the part immediately BEFORE this block — the `getSignalDelta` split
     *  point: lines `[0, before)` precede the block. */
    readonly before: number;
    /** Physical line count immediately AFTER. For a single captured line, this is that line's own
     *  1-based physical line number, which is what `LineData.physicalLineCount` documents. */
    readonly after: number;
}

/** Called from inside the append queue when a queued block is written. See {@link WritePosition}. */
export type WriteCallback = (position: WritePosition) => void;

/**
 * Format the marker/separator block a marker insertion writes. Lives here with the other line
 * formatters rather than inline in `LogSession.appendMarker`, which is about queueing the write.
 * The leading and trailing newlines are part of the block: they are what visually separates the
 * marker from surrounding output, and they count toward the physical line positions
 * `getSignalDelta` slices on.
 */
export function formatMarkerLine(customText?: string): string {
    const ts = new Date().toLocaleTimeString();
    return `\n--- MARKER: ${customText ? `${ts} — ${customText}` : ts} ---\n`;
}

/**
 * 1-based physical line number of the MARKER text itself, given the block's `before` position.
 *
 * The block {@link formatMarkerLine} writes is `\n--- MARKER: … ---\n`, plus the trailing `\n`
 * `appendMarker` adds — so a blank separator line sits at `before`, the marker text one line
 * after it, and another blank after that. A viewer or snackbar pointing at this marker wants the
 * text line, not the blank one that opens the block.
 */
export function markerTextLineNumber(before: number): number {
    return before + 2;
}

/** All context needed to format a single log line. */
export interface LineFormatContext {
    readonly timestamp: Date;
    readonly includeTimestamp: boolean;
    readonly sourceLocation?: SourceLocation;
    readonly includeSourceLocation: boolean;
    readonly elapsedMs?: number;
    readonly includeElapsedTime: boolean;
}

/** One queued captured line, as much of it as formatting needs. */
export interface QueuedLine {
    readonly text: string;
    readonly category: string;
    readonly timestamp: Date;
    readonly sourceLocation?: SourceLocation;
}

/**
 * Apply every configured decoration to one queued line — the timestamp/elapsed/source options
 * plus the elapsed-time computation they depend on. Pure, and pulled out of `LogSession` so the
 * write queue reads as the sequence of side effects it is (split, position, write, report) rather
 * than as formatting with a write buried in it.
 */
export function formatQueuedLine(
    line: QueuedLine,
    config: SaropaLogCaptureConfig,
    previousTimestamp: Date | undefined,
): string {
    return formatLine(line.text, line.category, {
        timestamp: line.timestamp,
        includeTimestamp: config.includeTimestamp,
        sourceLocation: line.sourceLocation,
        includeSourceLocation: config.includeSourceLocation,
        elapsedMs: computeElapsed(config.includeElapsedTime, previousTimestamp, line.timestamp),
        includeElapsedTime: config.includeElapsedTime,
    });
}

/** Format a log line with optional timestamp, elapsed time, category, and source. */
export function formatLine(
    text: string,
    category: string,
    ctx: LineFormatContext,
): string {
    const parts: string[] = [];
    if (ctx.includeTimestamp) {
        parts.push(`[${formatTimestamp(ctx.timestamp)}]`);
    }
    if (ctx.includeElapsedTime && ctx.elapsedMs !== undefined) {
        parts.push(`[${formatElapsedMs(ctx.elapsedMs)}]`);
    }
    parts.push(`[${category}]`);
    if (ctx.includeSourceLocation && ctx.sourceLocation?.path) {
        parts.push(`[${formatSourceLocation(ctx.sourceLocation)}]`);
    }
    parts.push(text);
    return parts.join(' ');
}

/** Format a Date as HH:MM:SS.mmm. */
export function formatTimestamp(ts: Date): string {
    return ts.toTimeString().slice(0, 8) + '.' +
        String(ts.getMilliseconds()).padStart(3, '0');
}

/** Format source location as "filename:line" or "filename:line:col". */
function formatSourceLocation(loc: SourceLocation): string {
    const name = loc.path?.split(/[\\/]/).pop() ?? 'unknown';
    if (loc.line === undefined) { return name; }
    if (loc.column !== undefined && loc.column > 0) {
        return `${name}:${loc.line}:${loc.column}`;
    }
    return `${name}:${loc.line}`;
}

/** Format elapsed ms as "+Nms", "+N.Ns", or "+Ns". */
function formatElapsedMs(ms: number): string {
    if (ms < 0) { return '+0ms'; }
    if (ms < 1000) { return `+${ms}ms`; }
    if (ms < 10000) { return `+${(ms / 1000).toFixed(1)}s`; }
    return `+${Math.round(ms / 1000)}s`;
}

/** Generate a continuation header for split log files. */
export function generateContinuationHeader(
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

/** Generate the context header block for the start of a log file. extraLines: from integration adapters, appended before divider. */
export function generateContextHeader(
    ctx: SessionContext,
    config: SaropaLogCaptureConfig,
    extraLines?: readonly string[],
): string {
    const lines: string[] = [];
    lines.push('=== SAROPA LOG CAPTURE — SESSION START ===');
    lines.push(`Extension version: ${ctx.extensionVersion}`);
    lines.push(`Date:           ${ctx.date.toISOString()}`);
    lines.push(`Project:        ${ctx.projectName}`);
    lines.push(`Debug Adapter:  ${ctx.debugAdapterType}`);
    lines.push(`launch.json:    ${ctx.configurationName}`);

    appendLaunchConfig(lines, ctx.configuration, config.redactEnvVars);

    lines.push(`VS Code:        ${ctx.vscodeVersion}`);
    lines.push(`Extension:      saropa-log-capture v${ctx.extensionVersion}`);
    lines.push(`OS:             ${ctx.os}`);
    appendDevEnvironment(lines, ctx.devEnvironment);
    if (extraLines?.length) {
        for (const l of extraLines) { lines.push(l); }
    }
    lines.push('==========================================');
    lines.push('');
    return lines.join('\n') + '\n';
}

/** Append launch config properties to header lines, redacting env vars. */
function appendLaunchConfig(
    lines: string[],
    configuration: vscode.DebugConfiguration,
    redactPatterns: readonly string[],
): void {
    const { type: _type, name: _name, request: _request, ...rest } = configuration;
    for (const [key, value] of Object.entries(rest)) {
        const padding = ' '.repeat(Math.max(1, 14 - key.length));
        if (key === 'env' && typeof value === 'object' && value !== null) {
            const redacted = redactEnv(
                value as Record<string, string>,
                redactPatterns
            );
            lines.push(`  ${key}:${padding}${JSON.stringify(redacted)}`);
        } else {
            lines.push(`  ${key}:${padding}${JSON.stringify(value)}`);
        }
    }
}

function appendDevEnvironment(lines: string[], env?: DevEnvironment): void {
    if (!env) { return; }
    if (env.gitBranch) { lines.push(`Git Branch:     ${env.gitBranch}`); }
    if (env.gitCommit) { lines.push(`Git Commit:     ${env.gitCommit}${env.gitDirty ? ' (dirty)' : ''}`); }
    if (env.gitRemote) { lines.push(`Git Remote:     ${env.gitRemote}`); }
    lines.push(`Node:           ${env.nodeVersion}`);
    if (env.remoteName) { lines.push(`Remote:         ${env.remoteName}`); }
}

/** Redact sensitive env vars using patterns from config. */
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

/**
 * Count real newline bytes in `text`. The single counting method physical-line accounting relies
 * on — used both at the write choke point (`LogSession.writeBackpressured`) and by
 * `performFileSplit`'s continuation-header count, so the two can never drift out of sync with each
 * other the way `_physicalLineCount` and the screenshot capturer's old counter once did.
 */
export function countNewlines(text: string): number {
    let count = 0;
    for (let i = 0; i < text.length; i++) { if (text.charCodeAt(i) === 10) { count++; } }
    return count;
}

/** Resolve the log directory URI for a session (date subfolder under config.logDirectory). */
export function getLogDirUri(context: SessionContext, config: SaropaLogCaptureConfig): vscode.Uri {
    const base = path.isAbsolute(config.logDirectory)
        ? vscode.Uri.file(config.logDirectory)
        : vscode.Uri.joinPath(context.workspaceFolder.uri, config.logDirectory);
    return vscode.Uri.joinPath(base, formatDateFolder(context.date));
}

/** Compute elapsed ms since previous line for optional [+Nms] in log lines. */
export function computeElapsed(
    includeElapsedTime: boolean,
    previousTimestamp: Date | undefined,
    current: Date,
): number | undefined {
    if (!includeElapsedTime || !previousTimestamp) {
        return undefined;
    }
    return current.getTime() - previousTimestamp.getTime();
}
