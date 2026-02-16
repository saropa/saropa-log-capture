/** Diagnostic types and helpers for Firebase Crashlytics setup troubleshooting. */

import * as vscode from 'vscode';

export interface DiagnosticDetails {
    readonly step: 'gcloud' | 'token' | 'config' | 'api';
    readonly errorType: 'missing' | 'permission' | 'network' | 'auth' | 'config' | 'http' | 'timeout';
    readonly message: string;
    readonly technicalDetails?: string;
    readonly httpStatus?: number;
    readonly checkedAt: number;
}

let outputChannel: vscode.OutputChannel | undefined;

/** Lazily create (or reuse) the shared "Saropa Log Capture" output channel. */
export function getOutputChannel(): vscode.OutputChannel {
    outputChannel ??= vscode.window.createOutputChannel('Saropa Log Capture');
    return outputChannel;
}

/** Log a Crashlytics diagnostic message to the output channel. */
export function logCrashlytics(level: 'info' | 'error', message: string): void {
    const prefix = level === 'error' ? '[Crashlytics] ERROR' : '[Crashlytics]';
    getOutputChannel().appendLine(`${prefix} ${message}`);
}

/** Classify a gcloud CLI error into a user-friendly diagnostic. */
export function classifyGcloudError(err: unknown): DiagnosticDetails {
    const code = (err as NodeJS.ErrnoException).code;
    const stderr = (err as Error & { stderr?: string }).stderr ?? '';
    const checkedAt = Date.now();
    if (code === 'ENOENT') {
        return { step: 'gcloud', errorType: 'missing', checkedAt, message: 'Google Cloud CLI not found in PATH', technicalDetails: 'Command "gcloud" not found. Install from https://cloud.google.com/sdk/docs/install' };
    }
    if (code === 'EACCES') {
        return { step: 'gcloud', errorType: 'permission', checkedAt, message: 'Permission denied running gcloud — check file permissions', technicalDetails: stderr || `Error code: ${code}` };
    }
    if (code === 'ETIMEDOUT' || (err instanceof Error && err.message.includes('timeout'))) {
        return { step: 'gcloud', errorType: 'timeout', checkedAt, message: 'gcloud command timed out', technicalDetails: stderr || 'The gcloud --version check did not respond in time' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { step: 'gcloud', errorType: 'missing', checkedAt, message: `gcloud check failed: ${msg}`, technicalDetails: stderr || msg };
}

/** Classify a gcloud auth token error into a user-friendly diagnostic. */
export function classifyTokenError(err: unknown): DiagnosticDetails {
    const stderr = (err as Error & { stderr?: string }).stderr ?? '';
    const checkedAt = Date.now();
    const lower = stderr.toLowerCase();
    if (lower.includes('no credentialed accounts') || lower.includes('could not automatically determine')) {
        return { step: 'token', errorType: 'auth', checkedAt, message: 'Not logged in — run: gcloud auth application-default login', technicalDetails: stderr };
    }
    if (lower.includes('token has been expired') || lower.includes('refresh token')) {
        return { step: 'token', errorType: 'auth', checkedAt, message: 'Credentials expired — run: gcloud auth application-default login', technicalDetails: stderr };
    }
    if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        return { step: 'token', errorType: 'timeout', checkedAt, message: 'Token request timed out', technicalDetails: stderr || 'The gcloud auth command did not respond in time' };
    }
    const msg = stderr || (err instanceof Error ? err.message : String(err));
    return { step: 'token', errorType: 'auth', checkedAt, message: `Authentication failed: ${msg.slice(0, 120)}`, technicalDetails: stderr || undefined };
}

/** Map an HTTP status code to a user-friendly error message. */
export function classifyHttpStatus(status: number, body?: string): string {
    if (status === 401) { return 'Authentication expired — token may be invalid or revoked'; }
    if (status === 403) { return 'Permission denied — your account needs the Firebase Crashlytics Viewer role'; }
    if (status === 404) { return 'Project or app not found — check firebase.projectId and firebase.appId settings'; }
    if (status === 429) { return 'Rate limited by Firebase API — try again in a few minutes'; }
    if (status >= 500) { return `Firebase API error (HTTP ${status}) — the service may be temporarily unavailable`; }
    const snippet = body ? body.slice(0, 100) : '';
    return `HTTP ${status}${snippet ? `: ${snippet}` : ''}`;
}
