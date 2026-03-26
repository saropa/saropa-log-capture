"use strict";
/** Diagnostic types and helpers for Firebase Crashlytics setup troubleshooting. */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseConfigSetupHint = void 0;
exports.getOutputChannel = getOutputChannel;
exports.logCrashlytics = logCrashlytics;
exports.classifyGcloudError = classifyGcloudError;
exports.classifyTokenError = classifyTokenError;
exports.classifyHttpStatus = classifyHttpStatus;
const vscode = __importStar(require("vscode"));
let outputChannel;
/** Lazily create (or reuse) the shared "Saropa Log Capture" output channel. */
function getOutputChannel() {
    outputChannel ??= vscode.window.createOutputChannel('Saropa Log Capture');
    return outputChannel;
}
/** Log a Crashlytics diagnostic message to the output channel. */
function logCrashlytics(level, message) {
    const prefix = level === 'error' ? '[Crashlytics] ERROR' : '[Crashlytics]';
    getOutputChannel().appendLine(`${prefix} ${message}`);
}
/** Classify a gcloud CLI error into a user-friendly diagnostic. */
function classifyGcloudError(err) {
    const code = err.code;
    const stderr = err.stderr ?? '';
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
function classifyTokenError(err) {
    const stderr = err.stderr ?? '';
    const checkedAt = Date.now();
    const lower = stderr.toLowerCase();
    if (lower.includes('no credentialed accounts') || lower.includes('could not automatically determine')) {
        return { step: 'token', errorType: 'auth', checkedAt, message: 'Not logged in — run: gcloud auth application-default login', technicalDetails: stderr };
    }
    if (lower.includes('token has been expired') || lower.includes('refresh token')) {
        return { step: 'token', errorType: 'auth', checkedAt, message: 'Credentials expired — run: gcloud auth application-default login', technicalDetails: stderr };
    }
    if (err.code === 'ETIMEDOUT') {
        return { step: 'token', errorType: 'timeout', checkedAt, message: 'Token request timed out', technicalDetails: stderr || 'The gcloud auth command did not respond in time' };
    }
    const msg = stderr || (err instanceof Error ? err.message : String(err));
    return { step: 'token', errorType: 'auth', checkedAt, message: `Authentication failed: ${msg.slice(0, 120)}`, technicalDetails: stderr || undefined };
}
/** Hint shown when Firebase config is missing or API returns 404 (single source of truth for path/settings). */
exports.firebaseConfigSetupHint = 'Add google-services.json (e.g. android/app/) or set saropaLogCapture.firebase.projectId / .appId in settings.';
/** Map an HTTP status code to a user-friendly error message. */
function classifyHttpStatus(status, body) {
    if (status === 401) {
        return 'Authentication expired — token may be invalid or revoked';
    }
    if (status === 403) {
        return 'Permission denied — your account needs the Firebase Crashlytics Viewer role';
    }
    if (status === 404) {
        return `Project or app not found. ${exports.firebaseConfigSetupHint}`;
    }
    if (status === 429) {
        return 'Rate limited by Firebase API — try again in a few minutes';
    }
    if (status >= 500) {
        return `Firebase API error (HTTP ${status}) — the service may be temporarily unavailable`;
    }
    const snippet = body ? body.slice(0, 100) : '';
    return `HTTP ${status}${snippet ? `: ${snippet}` : ''}`;
}
//# sourceMappingURL=crashlytics-diagnostics.js.map