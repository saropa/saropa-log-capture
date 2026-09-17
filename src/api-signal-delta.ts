/**
 * Run-scoped signal correlation (PLAN 119 / bugs/119_plan-run-scoped-signal-correlation-api.md).
 *
 * Backs {@link SaropaLogCaptureApi.getSignalDelta}. Unlike {@link getDailySummary}, this cannot
 * read from persisted `.session-metadata.json` fingerprints — those are only written when a
 * session is finalized (`session-lifecycle-finalize.ts`), but the whole point of this API is to
 * bracket a short window *inside* a still-running session. So this reads the session's own log
 * file(s) directly off disk, sliced at the two markers' physical-line boundaries recorded by
 * `SessionManagerImpl.insertMarker`, and re-runs the same line-level fingerprint scanners
 * (`scanLinesForFingerprints` / `scanLinesForWarningFingerprints` / `scanLinesForPerfFingerprints`)
 * against the "before" and "after" slices, then diffs the two fingerprint sets.
 *
 * Scope note: this covers error, warning, and perf signals — the three kinds derivable purely
 * from log text. SQL/network/memory/ANR-risk/Drift-Advisor signals live only in
 * `SessionMeta.signalSummary` / `driftSqlFingerprintSummary`, computed once at session
 * finalization; there is no live equivalent to re-run mid-session, so they are not part of a
 * marker-bounded delta.
 *
 * The window/boundary math (`readWindow`, `findEndOfSessionBound`) is the highest-risk part of
 * this file — off-by-one errors there silently misattribute signals across a marker or a file
 * split. It's factored behind an injectable {@link PartReader} so it can be pinned with plain
 * `node:test` cases using an in-memory fake, independent of the real `vscode.workspace.fs`-backed
 * reader used at runtime (see `src/test/api/signal-delta.test.ts`).
 */

import * as vscode from 'vscode';
import { getPartFileName } from './modules/capture/log-session-split';
import type { SessionManagerImpl } from './modules/session/session-manager';
import { scanLinesForFingerprints, type FingerprintEntry } from './modules/analysis/error-fingerprint';
import { scanLinesForWarningFingerprints } from './modules/analysis/warning-fingerprint';
import { scanLinesForPerfFingerprints, type PerfFingerprintEntry } from './modules/misc/perf-fingerprint';
import type { SaropaDailyTroubleItem, SaropaSignalDelta } from './api-types';

/** A position within a session's (possibly multi-part) log file. */
export interface FileBound {
    readonly partNumber: number;
    /** Physical line index into that part (0-based; matches `LogSession.physicalLineCount` semantics). */
    readonly physicalLineIndex: number;
}

/** Reads one part's lines by part number, or `undefined` if that part doesn't exist. */
export type PartReader = (partNumber: number) => Promise<string[] | undefined>;

/** Signals detected from one line slice, keyed by fingerprint kind for diffing. */
interface ScannedSignals {
    readonly errors: readonly FingerprintEntry[];
    readonly warnings: readonly FingerprintEntry[];
    readonly perf: readonly PerfFingerprintEntry[];
}

const sessionStartBound: FileBound = { partNumber: 0, physicalLineIndex: 0 };

/** Compute the new/resolved signal delta for the window between two markers. */
export async function getSignalDelta(
    sessionManager: SessionManagerImpl,
    sinceMarkerId: string,
    untilMarkerId?: string,
): Promise<SaropaSignalDelta | undefined> {
    const since = sessionManager.resolveMarker(sinceMarkerId);
    if (!since) { return undefined; }

    const untilRecord = untilMarkerId ? sessionManager.resolveMarker(untilMarkerId) : undefined;
    if (untilMarkerId && !untilRecord) { return undefined; }

    const reader = diskPartReader(since.logDirUri, since.baseFileName);
    const sinceBound: FileBound = { partNumber: since.partNumber, physicalLineIndex: since.physicalLineIndex };
    const untilBound: FileBound = untilRecord
        ? { partNumber: untilRecord.partNumber, physicalLineIndex: untilRecord.physicalLineIndex }
        : await resolveNowBound(sessionManager, since.sessionKey, since.partNumber, reader);

    return computeDelta(reader, sinceBound, untilBound);
}

/**
 * "Now" bound when `untilMarkerId` is omitted: the live session's current position if it's still
 * alive, otherwise the end of its last part on disk (session already ended — edge case #2 from
 * the plan: resolve against whatever exists, don't throw).
 */
async function resolveNowBound(
    sessionManager: SessionManagerImpl,
    sessionKey: string,
    sincePartNumber: number,
    reader: PartReader,
): Promise<FileBound> {
    const live = sessionManager.getLiveSessionState(sessionKey);
    if (live) { return { partNumber: live.partNumber, physicalLineIndex: live.physicalLineCount }; }
    return findEndOfSessionBound(reader, sincePartNumber);
}

/** Probe forward from `fromPart` for the last part that exists, and its line count. */
export async function findEndOfSessionBound(reader: PartReader, fromPart: number): Promise<FileBound> {
    let lastPart = fromPart;
    let lastLineCount = 0;
    for (let p = fromPart; ; p++) {
        const lines = await reader(p);
        if (lines === undefined) { break; }
        lastPart = p;
        lastLineCount = lines.length;
    }
    return { partNumber: lastPart, physicalLineIndex: lastLineCount };
}

/**
 * Read the lines in `[from, to)` across however many parts that spans. `from`/`to` are physical
 * line positions within their own part (see {@link FileBound}); parts strictly between them are
 * read in full. A part missing from disk (rotated/deleted) is skipped rather than failing the
 * whole read.
 */
export async function readWindow(reader: PartReader, from: FileBound, to: FileBound): Promise<string[]> {
    if (to.partNumber < from.partNumber || (to.partNumber === from.partNumber && to.physicalLineIndex <= from.physicalLineIndex)) {
        return [];
    }
    const collected: string[] = [];
    for (let p = from.partNumber; p <= to.partNumber; p++) {
        const lines = await reader(p);
        if (lines === undefined) { continue; }
        const start = p === from.partNumber ? from.physicalLineIndex : 0;
        const end = p === to.partNumber ? to.physicalLineIndex : lines.length;
        collected.push(...lines.slice(start, Math.max(start, end)));
    }
    return collected;
}

/** Real, `vscode.workspace.fs`-backed {@link PartReader} for one session's parts on disk. */
function diskPartReader(logDirUri: vscode.Uri, baseFileName: string): PartReader {
    return async (partNumber) => {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, getPartFileName(baseFileName, partNumber));
            const raw = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(raw).toString('utf-8').split('\n');
        } catch {
            return undefined;
        }
    };
}

/** Read the before/after windows via `reader` and diff their signals. Pure given a `PartReader`. */
export async function computeDelta(reader: PartReader, sinceBound: FileBound, untilBound: FileBound): Promise<SaropaSignalDelta> {
    const beforeLines = await readWindow(reader, sessionStartBound, sinceBound);
    const afterLines = await readWindow(reader, sinceBound, untilBound);

    const before = scanLines(beforeLines);
    const after = scanLines(afterLines);

    return {
        newSignals: [...diffFingerprints(before.errors, after.errors, 'error'), ...diffFingerprints(before.warnings, after.warnings, 'warning'), ...diffPerf(before.perf, after.perf)],
        resolvedSignals: [...diffFingerprints(after.errors, before.errors, 'error'), ...diffFingerprints(after.warnings, before.warnings, 'warning'), ...diffPerf(after.perf, before.perf)],
    };
}

function scanLines(lines: readonly string[]): ScannedSignals {
    return {
        errors: scanLinesForFingerprints(lines),
        warnings: scanLinesForWarningFingerprints(lines),
        perf: scanLinesForPerfFingerprints(lines),
    };
}

/** Entries in `after` whose hash isn't present in `before` (new-since / resolved-since, depending on call order). */
export function diffFingerprints(before: readonly FingerprintEntry[], after: readonly FingerprintEntry[], kind: 'error' | 'warning'): SaropaDailyTroubleItem[] {
    const beforeHashes = new Set(before.map((fp) => fp.h));
    return after
        .filter((fp) => !beforeHashes.has(fp.h))
        .map((fp) => ({
            label: fp.n,
            detail: fp.e,
            command: 'saropaLogCapture.openSignal',
            args: { id: `${kind}:${fp.h}` },
        }));
}

/** Same idea as {@link diffFingerprints} but perf fingerprints are keyed by operation name, not a hash. */
export function diffPerf(before: readonly PerfFingerprintEntry[], after: readonly PerfFingerprintEntry[]): SaropaDailyTroubleItem[] {
    const beforeNames = new Set(before.map((pf) => pf.name));
    return after
        .filter((pf) => !beforeNames.has(pf.name))
        .map((pf) => ({
            label: pf.name,
            detail: `${pf.count} occurrence${pf.count === 1 ? '' : 's'}, avg ${pf.avgMs}ms`,
            command: 'saropaLogCapture.openSignal',
            args: { id: `perf:${pf.name}` },
        }));
}
