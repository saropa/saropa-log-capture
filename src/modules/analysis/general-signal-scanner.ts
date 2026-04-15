/**
 * Extension-side general signal scanner.
 *
 * Scans a log file for network failures, memory events, slow operations,
 * permission denials, and classified errors using the same patterns as the
 * webview's collectRootCauseHintBundleEmbedded — but running on the
 * extension host so signals are detected even when the viewer is never opened.
 *
 * Produces a V2 summary with actual entries (fingerprint, label, count) so
 * cross-session views have full detail even for sessions where the viewer
 * was never opened. Falls back to V1-compatible counts for backwards compat.
 */

import * as vscode from 'vscode';
import {
    SIGNAL_SUMMARY_SCHEMA_VERSION_V2,
    type PersistedSignalSummaryV2, type PersistedSignalEntryV2, type SignalSummaryCounts,
} from '../root-cause-hints/signal-summary-types';

const maxScanLines = 5000;
const maxEntriesPerKind = 5;

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
const slowOpRe = /\bPERF\s+([\w.]+):\s*(\d+(?:\.\d+)?)\s*(ms|s)/i;
const durationRe = /(?:took|elapsed|duration[=:]?|in)\s*(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i;
const defaultSlowThresholdMs = 500;

/** Find the first matching pattern in a line, or undefined. */
function firstMatch(text: string, patterns: readonly string[]): string | undefined {
    return patterns.find(p => text.includes(p));
}

/** Extract duration in ms from a log line, or undefined if not a duration line. */
function extractDurationMs(text: string): { ms: number; name?: string } | undefined {
    const pm = slowOpRe.exec(text);
    if (pm) {
        const val = parseFloat(pm[2]);
        const ms = pm[3].toLowerCase() === 's' ? val * 1000 : val;
        return { ms, name: pm[1] };
    }
    const m = durationRe.exec(text);
    if (!m) { return undefined; }
    const val = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    return { ms: unit.startsWith('s') ? val * 1000 : val };
}

const maxLineIndicesPerEntry = 3;

/** Accumulate a signal entry by fingerprint, incrementing count and collecting line indices. */
function accum(map: Map<string, PersistedSignalEntryV2 & { count: number; _lines: number[] }>, entry: PersistedSignalEntryV2, lineIdx: number): void {
    const key = `${entry.kind}::${entry.fingerprint}`;
    const existing = map.get(key);
    if (existing) {
        existing.count += entry.count;
        // Keep the first N line indices for jump-to-line navigation
        if (existing._lines.length < maxLineIndicesPerEntry) { existing._lines.push(lineIdx); }
    } else {
        map.set(key, { ...entry, _lines: [lineIdx] });
    }
}

type EntryMap = Map<string, PersistedSignalEntryV2 & { count: number; _lines: number[] }>;

/** Classify a line and accumulate into the entry map. */
function classifyLine(line: string, lineIdx: number, entries: EntryMap, counts: Record<string, number>): void {
    const netMatch = firstMatch(line, networkPatterns);
    if (netMatch) {
        counts.networkFailures = (counts.networkFailures ?? 0) + 1;
        const label = line.trim().slice(0, 120) || 'Network failure';
        accum(entries, { kind: 'network', fingerprint: netMatch, label, count: 1 }, lineIdx);
    }
    const memMatch = firstMatch(line, memoryPatterns);
    if (memMatch) {
        counts.memoryEvents = (counts.memoryEvents ?? 0) + 1;
        const label = line.trim().slice(0, 120) || 'Memory event';
        accum(entries, { kind: 'memory', fingerprint: memMatch, label, count: 1 }, lineIdx);
    }
    const permMatch = firstMatch(line, permissionPatterns);
    if (permMatch) {
        counts.permissionDenials = (counts.permissionDenials ?? 0) + 1;
        const label = line.trim().slice(0, 120) || 'Permission denied';
        accum(entries, { kind: 'permission', fingerprint: permMatch, label, count: 1 }, lineIdx);
    }
    classifyErrorOrSlow(line, lineIdx, entries, counts);
}

/** Classify critical/bug errors and slow operations (separate function for nesting compliance). */
function classifyErrorOrSlow(line: string, lineIdx: number, entries: EntryMap, counts: Record<string, number>): void {
    const critMatch = firstMatch(line, criticalPatterns) ?? firstMatch(line, bugPatterns);
    if (critMatch) {
        counts.classifiedErrors = (counts.classifiedErrors ?? 0) + 1;
        const label = line.trim().slice(0, 120) || 'Classified error';
        const cat = criticalPatterns.includes(critMatch) ? 'critical' : 'bug';
        accum(entries, { kind: 'classified', fingerprint: critMatch, label, count: 1, category: cat }, lineIdx);
    }
    const dur = extractDurationMs(line);
    if (dur && dur.ms >= defaultSlowThresholdMs) {
        counts.slowOperations = (counts.slowOperations ?? 0) + 1;
        const name = dur.name ?? 'slow-op';
        accum(entries, { kind: 'slow-op', fingerprint: name, label: name, count: 1, avgDurationMs: dur.ms, maxDurationMs: dur.ms }, lineIdx);
    }
}

/** Cap entries per kind and finalize line indices. */
function capEntries(entries: EntryMap): PersistedSignalEntryV2[] {
    const byKind = new Map<string, (PersistedSignalEntryV2 & { _lines: number[] })[]>();
    for (const e of entries.values()) {
        const list = byKind.get(e.kind) ?? [];
        list.push(e);
        byKind.set(e.kind, list);
    }
    const result: PersistedSignalEntryV2[] = [];
    for (const list of byKind.values()) {
        list.sort((a, b) => b.count - a.count);
        for (const e of list.slice(0, maxEntriesPerKind)) {
            // Transfer collected line indices to the persisted entry; drop internal _lines
            const { _lines, ...entry } = e;
            result.push({ ...entry, lineIndices: _lines.length > 0 ? _lines : undefined });
        }
    }
    return result;
}

/**
 * Scan a log file for general signal patterns (network, memory, slow ops, etc.).
 * Returns a V2 signal summary with entries and counts. Returns undefined if nothing detected.
 * This runs on the extension host, not in the webview — so signals are captured
 * even for sessions where the viewer was never opened.
 */
export async function scanForGeneralSignals(fileUri: vscode.Uri): Promise<PersistedSignalSummaryV2 | undefined> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);

    const rawCounts: Record<string, number> = {};
    const entryMap: EntryMap = new Map();

    for (let i = 0; i < scanLimit; i++) {
        classifyLine(lines[i], i, entryMap, rawCounts);
    }

    const counts: SignalSummaryCounts = {
        networkFailures: rawCounts.networkFailures || undefined,
        memoryEvents: rawCounts.memoryEvents || undefined,
        slowOperations: rawCounts.slowOperations || undefined,
        permissionDenials: rawCounts.permissionDenials || undefined,
        classifiedErrors: rawCounts.classifiedErrors || undefined,
    };

    // Nothing detected — don't persist an empty summary
    const total = Object.values(rawCounts).reduce((s, v) => s + v, 0);
    if (total === 0) { return undefined; }

    const entries = capEntries(entryMap);
    return {
        schemaVersion: SIGNAL_SUMMARY_SCHEMA_VERSION_V2,
        counts,
        entries: entries.length > 0 ? entries : undefined,
    };
}
