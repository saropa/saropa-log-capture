/**
 * Error fingerprinting: normalize error lines and produce stable hashes.
 * Variations of the same error (different ports, timestamps, IDs) map
 * to the same fingerprint, enabling cross-session error grouping.
 * Called from session-lifecycle finalizeSession; results stored in SessionMetadata.
 */

import * as vscode from 'vscode';
import { isErrorLine } from '../features/error-rate-alert';
import { normalizeLine, hashFingerprint, classifyCategory, type CrashCategory } from './error-fingerprint-pure';
import { MAX_SCAN_LINES, warnIfScanCapped } from './scanner-line-cap';

export { normalizeLine, hashFingerprint, classifyCategory, type CrashCategory };

// bug_007: was a hard 5,000-line cap with no warning — errors past that line were
// silently invisible to fingerprinting. Raised via the shared MAX_SCAN_LINES; a cap
// hit now logs a warning (warnIfScanCapped) instead of truncating silently.
const maxScanLines = MAX_SCAN_LINES;
const maxFingerprints = 30;
const maxExampleLength = 200;

/** Compact fingerprint entry stored in sidecar metadata. */
export interface FingerprintEntry {
    readonly h: string;  // 8-char hex hash
    readonly n: string;  // normalized text
    readonly e: string;  // example line (truncated)
    readonly c: number;  // count in this session
    readonly cat?: CrashCategory;
}

/** Scan a log file and return error fingerprints grouped by hash. */
export async function scanForFingerprints(fileUri: vscode.Uri): Promise<FingerprintEntry[]> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    warnIfScanCapped('error-fingerprint', lines.length, scanLimit);
    const groups = new Map<string, FpAccum>();
    for (let i = 0; i < scanLimit; i++) {
        collectFingerprint(lines[i], groups);
    }
    return rankFingerprints(groups);
}

type FpAccum = { n: string; e: string; c: number; cat: CrashCategory };

function collectFingerprint(line: string, groups: Map<string, FpAccum>): void {
    const trimmed = line.trim();
    if (!trimmed || !isErrorLine(trimmed, 'stdout')) { return; }
    const normalized = normalizeLine(trimmed);
    if (normalized.length < 5) { return; }
    const hash = hashFingerprint(normalized);
    const existing = groups.get(hash);
    if (existing) {
        existing.c++;
    } else {
        groups.set(hash, { n: normalized, e: trimmed.slice(0, maxExampleLength), c: 1, cat: classifyCategory(trimmed) });
    }
}

function rankFingerprints(groups: Map<string, FpAccum>): FingerprintEntry[] {
    return [...groups.entries()]
        .sort((a, b) => b[1].c - a[1].c)
        .slice(0, maxFingerprints)
        .map(([h, { n, e, c, cat }]) => ({ h, n, e, c, cat: cat === 'non-fatal' ? undefined : cat }));
}
