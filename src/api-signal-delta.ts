/**
 * Run-scoped signal correlation (PLAN 119 / bugs/119_plan-run-scoped-signal-correlation-api.md).
 *
 * Backs {@link SaropaLogCaptureApi.getSignalDelta}. Unlike {@link getDailySummary}, this cannot
 * read from persisted `.session-metadata.json` fingerprints — those are only written when a
 * session is finalized (`session-lifecycle-finalize.ts`), but the whole point of this API is to
 * bracket a short window *inside* a still-running session. So this reads the session's own log
 * file(s) directly off disk, sliced at the two markers' physical-line boundaries recorded by
 * `SessionManagerImpl.insertMarker`, and re-runs the same line-level fingerprint scanners against
 * the relevant slices, then diffs the resulting fingerprint sets.
 *
 * Scope note: this covers error, warning, and perf signals — the three kinds derivable purely
 * from log text. SQL/network/memory/ANR-risk/Drift-Advisor signals live only in
 * `SessionMeta.signalSummary` / `driftSqlFingerprintSummary`, computed once at session
 * finalization; there is no live equivalent to re-run mid-session, so they are not part of a
 * marker-bounded delta.
 *
 * The window/boundary math lives in `api-signal-delta-window.ts` behind an injectable
 * `PartReader`; the scan step here is injectable too, so `computeDelta` — which decides which
 * slice is compared against which — is directly testable under `node:test`.
 */

import { scanLinesForFingerprints, type FingerprintEntry } from './modules/analysis/error-fingerprint';
import { scanLinesForWarningFingerprints } from './modules/analysis/warning-fingerprint';
import { scanLinesForPerfFingerprints, type PerfFingerprintEntry } from './modules/misc/perf-fingerprint';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { MarkerRecord } from './modules/session/session-marker-registry';
import type { SaropaDailyTroubleItem, SaropaSignalDelta } from './api-types';
import {
    diskPartReader,
    findEndOfSessionBound,
    readHistory,
    readWindow,
    type FileBound,
    type PartReader,
} from './api-signal-delta-window';

/** Signals detected from one line slice, keyed by fingerprint kind for diffing. */
export interface ScannedSignals {
    readonly errors: readonly FingerprintEntry[];
    readonly warnings: readonly FingerprintEntry[];
    readonly perf: readonly PerfFingerprintEntry[];
}

/** Fingerprints one slice of log lines. Injectable so `computeDelta` is testable without `vscode`. */
export type LineScanner = (lines: readonly string[]) => ScannedSignals;

/** How much history before the marker the "was this already happening?" question looks at. */
const maxHistoryLines = 50_000;

/** Ceiling on the marker-bounded window itself, so one very chatty command can't be unbounded. */
const maxWindowLines = 50_000;

/**
 * How long to wait for a marker whose write is still queued. `insertMarker` returns its id
 * synchronously but the marker's file position is only known once the append queue reaches it,
 * so a caller that brackets a very fast command can legitimately ask before the write lands.
 */
const markerSettleTimeoutMs = 2_000;

/** Rank cap disabled — a set difference needs the complete fingerprint set. See `LineScanOptions`. */
const unlimitedFingerprints = Number.POSITIVE_INFINITY;

const emptySignals: ScannedSignals = { errors: [], warnings: [], perf: [] };

/** Compute the new/resolved signal delta for the window between two markers. */
export async function getSignalDelta(
    sessionManager: SessionManagerImpl,
    sinceMarkerId: string,
    untilMarkerId?: string,
): Promise<SaropaSignalDelta | undefined> {
    const since = await sessionManager.waitForMarkerPosition(sinceMarkerId, markerSettleTimeoutMs);
    if (!since?.position) { return undefined; }

    let until: MarkerRecord | undefined;
    if (untilMarkerId !== undefined) {
        until = await sessionManager.waitForMarkerPosition(untilMarkerId, markerSettleTimeoutMs);
        if (!until?.position || !isSameSession(since, until)) { return undefined; }
    }

    const reader = diskPartReader(since.logDirUri, since.baseFileName);
    const untilBound = until?.position
        ?? await resolveNowBound(sessionManager, since.sessionKey, since.position.partNumber, reader);

    return computeDelta(reader, since.position, untilBound);
}

/**
 * Both markers must belong to one session's files. A marker id carries offsets that only mean
 * anything against the files that produced them, so applying a second session's offsets to the
 * first session's parts would read an arbitrary slice and report confident nonsense — which is
 * reachable in normal use, since a bracketed command (an install, a `pm clear`) can itself restart
 * the app and therefore the debug session.
 */
function isSameSession(since: MarkerRecord, until: MarkerRecord): boolean {
    return since.sessionKey === until.sessionKey && since.baseFileName === until.baseFileName;
}

/**
 * "Now" bound when `untilMarkerId` is omitted: the live session's current position if it's still
 * alive, otherwise the end of its last part on disk (session already ended — edge case #2 from
 * the plan: resolve against whatever exists, don't throw).
 *
 * The live counter is incremented before the stream write is flushed, so it can name a line the
 * file does not hold yet; `readWindow` slices against the part's real length, so that resolves as
 * a slightly short window rather than an error.
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

/**
 * Read the slices this delta needs and diff them. Pure given a `PartReader` and a `LineScanner`.
 *
 * Three slices, not two, because "new" and "resolved" are not the same question:
 *
 *  - `after` — the marker-bounded window itself.
 *  - `history` — up to {@link maxHistoryLines} before the marker. A signal is NEW if the window
 *    has it and this doesn't: "did the bracketed command introduce something this session had not
 *    produced before?" wants as much prior evidence as it can afford.
 *  - `baseline` — the tail of `history` the same length as `after`. A signal is RESOLVED if the
 *    baseline has it and the window doesn't. Comparing the window against all of `history`
 *    instead — as the first cut of this API did — makes every signal that merely failed to repeat
 *    inside a 20-second window read as "resolved", so a command that logged nothing at all would
 *    report the session's entire signal set as fixed by it. Matching the lengths makes it a
 *    like-for-like comparison, and an empty window is reported as resolving nothing at all,
 *    because no output is no evidence.
 */
export async function computeDelta(
    reader: PartReader,
    sinceBound: FileBound,
    untilBound: FileBound,
    scan: LineScanner = scanLines,
): Promise<SaropaSignalDelta> {
    const afterLines = await readWindow(reader, sinceBound, untilBound, maxWindowLines);
    const historyLines = await readHistory(reader, sinceBound, maxHistoryLines);

    const after = scan(afterLines);
    const history = scan(historyLines);
    const baseline = scanBaseline(historyLines, history, afterLines.length, scan);

    return {
        newSignals: diffAll(history, after),
        resolvedSignals: diffAll(after, baseline),
    };
}

/**
 * The equal-length tail of the history slice that the resolved comparison is made against.
 * Reuses the already-scanned `history` when the window is at least as long as the history, since
 * the slice would then be the same lines and scanning up to 50,000 of them twice is not free.
 */
function scanBaseline(historyLines: readonly string[], history: ScannedSignals, windowLength: number, scan: LineScanner): ScannedSignals {
    if (windowLength === 0) { return emptySignals; }
    if (windowLength >= historyLines.length) { return history; }
    return scan(historyLines.slice(-windowLength));
}

/** Every signal present in `after` but not in `before`, across all three fingerprint kinds. */
function diffAll(before: ScannedSignals, after: ScannedSignals): SaropaDailyTroubleItem[] {
    return [
        ...diffFingerprints(before.errors, after.errors, 'error'),
        ...diffFingerprints(before.warnings, after.warnings, 'warning'),
        ...diffPerf(before.perf, after.perf),
    ];
}

/** The real, `vscode`-backed scanner: the complete fingerprint set for a slice, uncapped. */
function scanLines(lines: readonly string[]): ScannedSignals {
    // Both caps are lifted deliberately. The rank cap would drop a "before" fingerprint that then
    // reads as newly introduced the next time it occurs, and the line cap (a tenth as large for
    // perf) would hide the middle of a window from one side of a comparison it did appear in.
    const options = { maxFingerprints: unlimitedFingerprints, maxScanLines: lines.length };
    return {
        errors: scanLinesForFingerprints(lines, options),
        warnings: scanLinesForWarningFingerprints(lines, options),
        perf: scanLinesForPerfFingerprints(lines, options),
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
