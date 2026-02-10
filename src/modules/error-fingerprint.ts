/**
 * Error fingerprinting: normalize error lines and produce stable hashes.
 *
 * Variations of the same error (different ports, timestamps, IDs) map
 * to the same fingerprint, enabling cross-session error grouping.
 */

import * as vscode from 'vscode';
import { stripAnsi } from './ansi';
import { isErrorLine } from './error-rate-alert';

const maxScanLines = 5000;
const maxFingerprints = 30;
const maxExampleLength = 200;

/** Crash category for error sub-classification. */
export type CrashCategory = 'fatal' | 'anr' | 'oom' | 'native' | 'non-fatal';

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
    const groups = new Map<string, FpAccum>();
    for (let i = 0; i < scanLimit; i++) {
        collectFingerprint(lines[i], groups);
    }
    return rankFingerprints(groups);
}

/** Normalize a single line for fingerprinting. */
export function normalizeLine(text: string): string {
    let s = stripAnsi(text);
    s = s.replace(/^\[[\d:.,T\-Z ]+\]\s*/, '');
    s = s.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '<TS>');
    s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>');
    s = s.replace(/\b0x[0-9a-fA-F]{4,}\b/g, '<HEX>');
    s = s.replace(/\b\d{2,}\b/g, '<N>');
    s = s.replace(/(?:[a-zA-Z]:)?[\\/](?:[\w.\-]+[\\/])+/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

/** FNV-1a 32-bit hash, returned as 8-char hex. */
export function hashFingerprint(normalized: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

const anrRe = /ANR|Application Not Responding|Input dispatching timed out/i;
const oomRe = /OutOfMemoryError|heap exhaustion|\bOOM\b|Cannot allocate/i;
const nativeRe = /SIGSEGV|SIGABRT|SIGBUS|libflutter\.so|native crash/i;
const fatalRe = /\bFATAL\b|unhandled exception|uncaught/i;

/** Classify an error line into a crash category. */
export function classifyCategory(text: string): CrashCategory {
    if (anrRe.test(text)) { return 'anr'; }
    if (oomRe.test(text)) { return 'oom'; }
    if (nativeRe.test(text)) { return 'native'; }
    if (fatalRe.test(text)) { return 'fatal'; }
    return 'non-fatal';
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
