/**
 * Helper functions and types for LogSession.
 *
 * Contains the SessionContext interface and pure functions for
 * filename generation, line formatting, and context header creation.
 */

import * as vscode from 'vscode';
import { SaropaLogCaptureConfig, shouldRedactEnvVar } from './config';
import { SplitReason, formatSplitReason } from './file-splitter';

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

/** Generate base filename without .log extension (for split naming). */
export function generateBaseFileName(projectName: string, date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${y}${mo}${d}_${h}-${mi}-${s}_${safeName}`;
}

/** Format a log line with optional timestamp and category prefix. */
export function formatLine(
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

/** Generate the context header block for the start of a log file. */
export function generateContextHeader(
    ctx: SessionContext,
    config: SaropaLogCaptureConfig
): string {
    const lines: string[] = [];
    lines.push('=== SAROPA LOG CAPTURE — SESSION START ===');
    lines.push(`Date:           ${ctx.date.toISOString()}`);
    lines.push(`Project:        ${ctx.projectName}`);
    lines.push(`Debug Adapter:  ${ctx.debugAdapterType}`);
    lines.push(`launch.json:    ${ctx.configurationName}`);

    appendLaunchConfig(lines, ctx.configuration, config.redactEnvVars);

    lines.push(`VS Code:        ${ctx.vscodeVersion}`);
    lines.push(`Extension:      saropa-log-capture v${ctx.extensionVersion}`);
    lines.push(`OS:             ${ctx.os}`);
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
