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

/**
 * True when a failed command means "executable not found". `ENOENT` covers a direct spawn, but with
 * `shell: true` (required for the gcloud.cmd shim) a missing command is NOT ENOENT — the shell itself
 * reports it: cmd.exe prints "'gcloud' is not recognized…" (exit 1/9009) and POSIX shells print
 * "command not found". Without this check those land in the generic branch and the user is told the
 * command "failed" with no hint that gcloud simply is not on PATH. (bug_008)
 */
function isCommandMissing(code: unknown, message: string, stderr: string): boolean {
    if (code === 'ENOENT') { return true; }
    const haystack = `${message} ${stderr}`.toLowerCase();
    return haystack.includes('is not recognized') || haystack.includes('command not found');
}

/** Classify a gcloud CLI error into a user-friendly diagnostic. */
export function classifyGcloudError(err: unknown): DiagnosticDetails {
    const code = (err as NodeJS.ErrnoException).code;
    const stderr = (err as Error & { stderr?: string }).stderr ?? '';
    const message = err instanceof Error ? err.message : String(err);
    const checkedAt = Date.now();
    if (isCommandMissing(code, message, stderr)) {
        return { step: 'gcloud', errorType: 'missing', checkedAt, message: 'Google Cloud CLI not found in PATH', technicalDetails: 'Command "gcloud" not found. Install it, then fully restart VS Code so it picks up the new PATH — or set a service account key. See https://cloud.google.com/sdk/docs/install' };
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
    const message = err instanceof Error ? err.message : String(err);
    const checkedAt = Date.now();
    const lower = stderr.toLowerCase();
    // A token fetch that fails because gcloud itself is absent must report "CLI not found", not
    // "authentication failed" — otherwise the user chases a sign-in problem that does not exist. (bug_008)
    if (isCommandMissing((err as NodeJS.ErrnoException).code, message, stderr)) {
        return { step: 'gcloud', errorType: 'missing', checkedAt, message: 'Google Cloud CLI not found in PATH', technicalDetails: 'gcloud is required for sign-in. Install it and fully restart VS Code, or set a service account key.' };
    }
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

/** Hint shown when Firebase config is missing or API returns 404 (single source of truth for path/settings). */
export const firebaseConfigSetupHint = 'Add google-services.json (e.g. android/app/) or set saropaLogCapture.firebase.projectId / .appId in settings.';

/** Re-auth command that grants both cloud-platform and the Play reporting scope (single source of truth). */
export const playReportingScopeFix = 'gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/playdeveloperreporting';

/**
 * Map an HTTP status code (and, when present, the response body) to an actionable message.
 *
 * The 403 branch decodes the two real causes seen in the field rather than guessing a single one:
 * ACCESS_TOKEN_SCOPE_INSUFFICIENT (the ADC token lacks the Play reporting scope — the default
 * `gcloud auth application-default login` does not request it) and SERVICE_DISABLED (the API is not
 * enabled on the project). Both get a concrete fix so the user is never left at a bare "Permission
 * denied". Falling back to the role hint only when neither marker is present.
 */
export function classifyHttpStatus(status: number, body?: string): string {
    const b = (body ?? '').toLowerCase();
    if (status === 401) { return 'Authentication expired — token may be invalid or revoked'; }
    if (status === 403) {
        if (b.includes('access_token_scope_insufficient') || b.includes('insufficient authentication scopes')) {
            return `Sign-in is missing the Play reporting scope. Re-run: ${playReportingScopeFix}`;
        }
        if (b.includes('service_disabled') || b.includes('has not been used in project') || b.includes('it is disabled')) {
            return 'The Play Developer Reporting API is not enabled for this project — run: gcloud services enable playdeveloperreporting.googleapis.com, then retry.';
        }
        if (b.includes('quota project')) {
            return 'Sign-in has no quota project. Re-run gcloud auth application-default login, or set saropaLogCapture.firebase.projectId.';
        }
        return 'Permission denied — your account needs access to this app in the Play Console / Firebase project.';
    }
    if (status === 404) { return `Endpoint or app not found (HTTP 404). ${firebaseConfigSetupHint}`; }
    if (status === 429) { return 'Rate limited by the API — try again in a few minutes'; }
    if (status >= 500) { return `Server error (HTTP ${status}) — the service may be temporarily unavailable`; }
    const snippet = body ? body.slice(0, 100) : '';
    return `HTTP ${status}${snippet ? `: ${snippet}` : ''}`;
}
