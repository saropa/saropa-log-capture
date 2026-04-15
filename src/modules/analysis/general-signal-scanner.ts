/**
 * Extension-side general signal scanner.
 *
 * Scans a log file for network failures, memory events, slow operations,
 * permission denials, and classified errors using the same patterns as the
 * webview's collectRootCauseHintBundleEmbedded — but running on the
 * extension host so signals are detected even when the viewer is never opened.
 *
 * Returns a PersistedSignalSummaryV1 that can be merged with any existing
 * viewer-collected summary. Only counts and top-level identifiers are returned
 * (no line indices) — this is a complement to fingerprint scanning, not a
 * replacement for the full webview signal collection.
 */

import * as vscode from 'vscode';
import { SIGNAL_SUMMARY_SCHEMA_VERSION, type PersistedSignalSummaryV1, type SignalSummaryCounts } from '../root-cause-hints/signal-summary-types';

const maxScanLines = 5000;

/** Patterns mirroring the webview's rchNetworkPatterns, rchMemoryPatterns, etc. */
const networkPatterns = [
    'SocketException', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
    'ECONNRESET', 'EPIPE', 'Connection refused', 'Network error',
    'Connection reset', 'Connection timed out', 'TimeoutException',
];
const memoryPatterns = [
    'OutOfMemoryError', 'OOM', 'heap exhaustion', 'Cannot allocate',
    'Out of memory', 'memory pressure',
];
const permissionPatterns = [
    'PermissionDenied', 'PERMISSION_DENIED', 'SecurityException',
    'EACCES', 'EPERM', 'Permission denied', 'Access denied',
];
const criticalPatterns = [
    'NullPointerException', 'NullReferenceException', 'AssertionError',
    'FATAL', 'Segmentation fault', 'Stack overflow', 'Panic',
    'Unhandled exception',
];
const bugPatterns = [
    'undefined is not a function', 'Cannot read property',
    'is not defined', 'SyntaxError', 'ReferenceError', 'TypeError',
    'Uncaught', 'Unexpected token', 'Invalid argument',
];

/** Duration regex — matches "took 503ms", "elapsed: 2.3s", "PERF opName: 100ms", etc. */
const slowOpRe = /\bPERF\s+[\w.]+:\s*(\d+(?:\.\d+)?)\s*(ms|s)/i;
const durationRe = /(?:took|elapsed|duration[=:]?|in)\s*(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i;
const defaultSlowThresholdMs = 500;

/** Check if any pattern in the array appears in the text. */
function matchesAny(text: string, patterns: readonly string[]): boolean {
    return patterns.some(p => text.includes(p));
}

/** Extract duration in ms from a log line, or undefined if not a duration line. */
function extractDurationMs(text: string): number | undefined {
    const pm = slowOpRe.exec(text);
    if (pm) {
        const val = parseFloat(pm[1]);
        return pm[2].toLowerCase() === 's' ? val * 1000 : val;
    }
    const m = durationRe.exec(text);
    if (!m) { return undefined; }
    const val = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    return unit.startsWith('s') ? val * 1000 : val;
}

/**
 * Scan a log file for general signal patterns (network, memory, slow ops, etc.).
 * Returns a signal summary with counts. Returns undefined if nothing detected.
 * This runs on the extension host, not in the webview — so signals are captured
 * even for sessions where the viewer was never opened.
 */
export async function scanForGeneralSignals(fileUri: vscode.Uri): Promise<PersistedSignalSummaryV1 | undefined> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);

    let networkFailures = 0;
    let memoryEvents = 0;
    let slowOperations = 0;
    let permissionDenials = 0;
    let classifiedErrors = 0;

    for (let i = 0; i < scanLimit; i++) {
        const line = lines[i];
        if (matchesAny(line, networkPatterns)) { networkFailures++; }
        if (matchesAny(line, memoryPatterns)) { memoryEvents++; }
        if (matchesAny(line, permissionPatterns)) { permissionDenials++; }
        if (matchesAny(line, criticalPatterns) || matchesAny(line, bugPatterns)) { classifiedErrors++; }
        // Slow operation: line must have a duration above the threshold
        const dur = extractDurationMs(line);
        if (dur !== undefined && dur >= defaultSlowThresholdMs) { slowOperations++; }
    }

    const counts: SignalSummaryCounts = {
        networkFailures: networkFailures || undefined,
        memoryEvents: memoryEvents || undefined,
        slowOperations: slowOperations || undefined,
        permissionDenials: permissionDenials || undefined,
        classifiedErrors: classifiedErrors || undefined,
    };

    // Nothing detected — don't persist an empty summary
    if (!networkFailures && !memoryEvents && !slowOperations && !permissionDenials && !classifiedErrors) {
        return undefined;
    }

    return { schemaVersion: SIGNAL_SUMMARY_SCHEMA_VERSION, counts };
}
