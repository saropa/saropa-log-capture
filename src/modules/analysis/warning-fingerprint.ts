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

const maxScanLines = 5000;
const maxFingerprints = 30;
const maxExampleLength = 200;

/** Scan a log file and return warning fingerprints grouped by hash. */
export async function scanForWarningFingerprints(fileUri: vscode.Uri): Promise<FingerprintEntry[]> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    const groups = new Map<string, WarnAccum>();
    for (let i = 0; i < scanLimit; i++) {
        collectWarningFingerprint(lines[i], groups);
    }
    return rankWarningFingerprints(groups);
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
function rankWarningFingerprints(groups: Map<string, WarnAccum>): FingerprintEntry[] {
    return [...groups.entries()]
        .sort((a, b) => b[1].c - a[1].c)
        .slice(0, maxFingerprints)
        .map(([h, { n, e, c }]) => ({ h, n, e, c }));
}
