/**
 * Warning fingerprinting: normalize warning lines and produce stable hashes.
 * Mirrors error-fingerprint.ts but detects warnings instead of errors.
 * Variations of the same warning (different timestamps, IDs, paths) map
 * to the same fingerprint, enabling cross-session warning grouping.
 * Called from session-lifecycle finalizeSession; results stored in SessionMetadata.
 */

import * as vscode from 'vscode';
import { isWarningLine } from '../features/error-rate-alert';
import { isErrorLine } from '../features/error-rate-alert';
import { normalizeLine, hashFingerprint } from './error-fingerprint-pure';
import type { FingerprintEntry } from './error-fingerprint';
import { MAX_SCAN_LINES, warnIfScanCapped, type LineScanOptions } from './scanner-line-cap';

// bug_007: raised from a silent 5,000-line cap — see scanner-line-cap.ts.
const maxScanLines = MAX_SCAN_LINES;
const maxFingerprints = 30;
const maxExampleLength = 200;

/** Scan a log file and return warning fingerprints grouped by hash. */
export async function scanForWarningFingerprints(fileUri: vscode.Uri): Promise<FingerprintEntry[]> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    return scanLinesForWarningFingerprints(text.split('\n'));
}

/**
 * Scan already-loaded lines and return warning fingerprints grouped by hash. Factored out of
 * {@link scanForWarningFingerprints} so a caller that already has a line slice in memory (e.g. a
 * marker-bounded window read straight off disk) can fingerprint it without a second file read.
 *
 * `options` lifts the presentation caps for a caller that diffs two scans — see
 * {@link LineScanOptions} for why a ranked, truncated list is the wrong input to a set difference.
 */
export function scanLinesForWarningFingerprints(lines: readonly string[], options?: LineScanOptions): FingerprintEntry[] {
    const scanLimit = Math.min(lines.length, options?.maxScanLines ?? maxScanLines);
    warnIfScanCapped('warning-fingerprint', lines.length, scanLimit);
    const groups = new Map<string, WarnAccum>();
    for (let i = 0; i < scanLimit; i++) {
        collectWarningFingerprint(lines[i], groups);
    }
    return rankWarningFingerprints(groups, options?.maxFingerprints ?? maxFingerprints);
}

type WarnAccum = { n: string; e: string; c: number };

/**
 * Collect a warning fingerprint from a log line.
 * Only matches lines that are warnings but NOT errors — errors have their
 * own fingerprint pipeline and shouldn't be double-counted.
 */
function collectWarningFingerprint(line: string, groups: Map<string, WarnAccum>): void {
    const trimmed = line.trim();
    if (!trimmed) { return; }
    // Must be a warning line but NOT an error line (avoid double-counting)
    if (!isWarningLine(trimmed) || isErrorLine(trimmed, 'stdout')) { return; }
    const normalized = normalizeLine(trimmed);
    if (normalized.length < 5) { return; }
    const hash = hashFingerprint(normalized);
    const existing = groups.get(hash);
    if (existing) {
        existing.c++;
    } else {
        groups.set(hash, { n: normalized, e: trimmed.slice(0, maxExampleLength), c: 1 });
    }
}

/** Rank warnings by frequency (descending) and cap at maxFingerprints. */
function rankWarningFingerprints(groups: Map<string, WarnAccum>, limit: number): FingerprintEntry[] {
    return [...groups.entries()]
        .sort((a, b) => b[1].c - a[1].c)
        .slice(0, limit)
        .map(([h, { n, e, c }]) => ({ h, n, e, c }));
}
