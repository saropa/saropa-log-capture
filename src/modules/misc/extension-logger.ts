/**
 * Extension-wide logging to the "Saropa Log Capture" output channel.
 *
 * Set the channel once from the extension entry point (setExtensionLogger).
 * All log calls then append to that channel so users and support can inspect
 * errors and warnings in one place.
 */

import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/**
 * Set the output channel used for extension logging. Call once at activation.
 */
export function setExtensionLogger(outputChannel: vscode.OutputChannel): void {
    channel = outputChannel;
}

/**
 * Get the current logger channel. If never set, creates a fallback channel.
 */
export function getExtensionLogger(): vscode.OutputChannel {
    if (channel) { return channel; }
    channel = vscode.window.createOutputChannel('Saropa Log Capture');
    return channel;
}

/**
 * Log an error with optional context. Use for failures and unexpected conditions.
 */
export function logExtensionError(context: string, messageOrError: string | Error): void {
    const msg = typeof messageOrError === 'string' ? messageOrError : messageOrError.message;
    getExtensionLogger().appendLine(`[${context}] ERROR ${msg}`);
}

/**
 * Log a warning. Use for recoverable or degraded behavior.
 */
export function logExtensionWarn(context: string, message: string): void {
    getExtensionLogger().appendLine(`[${context}] WARN ${message}`);
}

/**
 * Log an info message. Use sparingly (e.g. session start/stop, retention).
 */
export function logExtensionInfo(context: string, message: string): void {
    getExtensionLogger().appendLine(`[${context}] ${message}`);
}
