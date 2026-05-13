/**
 * Regression and recovery detector (plan 052 F7/F8).
 *
 * Two cross-session signals computed from already-persisted session fingerprints — no new
 * collector, no new storage:
 *
 *   F7 NEW ERROR TYPE: an error fingerprint that appears in the current session but did not
 *     appear in any of the previous M sessions. Surfaces as a "regression detector" — "you just
 *     introduced a new crash". High signal value because new fingerprints almost always mean
 *     either a real regression or a newly-reachable code path.
 *
 *   F8 DISAPPEARING ERROR: an error fingerprint that appeared in past M sessions but is absent
 *     in the current session. Positive signal — "this error you used to see has not reoccurred".
 *     Rewards good fixes. Currently the signal panel only surfaces problems, so this is the
 *     first positive signal in the panel.
 *
 * Both share the same input: current session's fingerprint set and the set assembled from the
 * previous M sessions. Set-difference both ways, return labeled entries. M is configurable but
 * defaults to 10 — enough to filter rare/intermittent fingerprints, short enough that
 * "disappeared" still means "recently absent" rather than "ancient history".
 */

import type { LoadedMeta } from '../session/metadata-loader';
import type { FingerprintEntry } from '../analysis/error-fingerprint';
import type { RecurringSignalEntry, SignalSeverity } from '../misc/recurring-signal-builder';

/** Default lookback for what counts as "past" — last N sessions before the current one. */
export const REGRESSION_DEFAULT_LOOKBACK_SESSIONS = 10;

export interface RegressionDetectionInput {
    /** Fingerprints scanned from the currently-open session. */
    readonly currentFingerprints: readonly FingerprintEntry[];
    /** Past session metadatas, ordered from oldest to newest (caller's responsibility). */
    readonly pastMetas: readonly LoadedMeta[];
    /** Override the default lookback. */
    readonly lookbackSessions?: number;
}

export interface NewErrorRegression {
    readonly hash: string;
    readonly example: string;
    readonly count: number;
}

export interface DisappearingError {
    readonly hash: string;
    readonly example: string;
    /** Filename of the most recent session where this fingerprint was last observed. */
    readonly lastSeenSession: string;
    /** Number of sessions back when this was last seen (1 = previous session). */
    readonly sessionsAgo: number;
}

export interface RegressionDetectionResult {
    readonly newErrors: readonly NewErrorRegression[];
    readonly disappearingErrors: readonly DisappearingError[];
}

/**
 * Compute regressions and recoveries. Pure function — no I/O. Caller loads metadatas.
 *
 * The pastMetas array MUST be ordered oldest → newest so "sessionsAgo" is meaningful. Callers
 * typically slice the most recent N from a date-sorted list and reverse if needed.
 */
export function detectRegressions(input: RegressionDetectionInput): RegressionDetectionResult {
    const lookback = input.lookbackSessions ?? REGRESSION_DEFAULT_LOOKBACK_SESSIONS;
    /* Slice to the last N past sessions so older history doesn't dilute the comparison.
       Older fingerprints would still be "in the past" but tagging them as "disappeared" is
       misleading — they may have disappeared long ago for unrelated reasons. */
    const considered = input.pastMetas.slice(-lookback);

    // Build the past-fingerprint set. Map hash → { example, lastSeenSession, sessionsAgo }
    const pastByHash = new Map<string, DisappearingError>();
    for (let idx = 0; idx < considered.length; idx++) {
        const lm = considered[idx];
        const sessionsAgo = considered.length - idx; // newest past = 1, oldest considered = lookback
        const fps = lm.meta.fingerprints ?? [];
        for (const fp of fps) {
            if (!fp || !fp.h) { continue; }
            const existing = pastByHash.get(fp.h);
            /* Keep the *most recent* occurrence in the map. Iterating oldest → newest, the later
               write wins because newer indices have smaller sessionsAgo values. */
            if (!existing || sessionsAgo < existing.sessionsAgo) {
                pastByHash.set(fp.h, {
                    hash: fp.h,
                    example: fp.e || fp.n || fp.h,
                    lastSeenSession: lm.filename,
                    sessionsAgo,
                });
            }
        }
    }

    // F7: fingerprints in current but not in past
    const newErrors: NewErrorRegression[] = [];
    const currentHashes = new Set<string>();
    for (const fp of input.currentFingerprints) {
        if (!fp || !fp.h) { continue; }
        currentHashes.add(fp.h);
        if (!pastByHash.has(fp.h)) {
            newErrors.push({
                hash: fp.h,
                example: fp.e || fp.n || fp.h,
                count: fp.c ?? 1,
            });
        }
    }

    // F8: fingerprints in past but not in current
    const disappearingErrors: DisappearingError[] = [];
    for (const [hash, info] of pastByHash) {
        if (!currentHashes.has(hash)) {
            disappearingErrors.push(info);
        }
    }
    /* Sort disappearing by recency (most recent first) so the user sees "recently fixed" before
       "fixed a while ago". New errors stay in the order they appeared in the current session —
       order maps to first-occurrence time which is useful debugging context. */
    disappearingErrors.sort((a, b) => a.sessionsAgo - b.sessionsAgo);

    return { newErrors, disappearingErrors };
}

/**
 * Format detection results as RecurringSignalEntry items that the existing signals-in-this-log
 * renderer already knows how to display. Both kinds use 'error' kind (the existing union doesn't
 * have 'regression'/'recovery') but carry distinctive label prefixes so the user can tell them
 * apart visually. Severity carries the priority signal: new errors are HIGH (active problem),
 * disappearing errors are LOW (positive signal — drawing too much attention here would crowd
 * out actionable problems).
 */
export function buildRegressionSignalEntries(
    sessionFilename: string,
    detection: RegressionDetectionResult,
): RecurringSignalEntry[] {
    const out: RecurringSignalEntry[] = [];

    /* Cap per-side so a session that just rotated 30 fingerprints doesn't flood the panel with
       30 "new" entries. 5 is enough to be meaningful, small enough to keep the panel scannable. */
    const cap = 5;
    for (const ne of detection.newErrors.slice(0, cap)) {
        out.push({
            kind: 'error',
            fingerprint: `regression::new::${ne.hash}`,
            label: `🆕 New error type: ${ne.example}`,
            detail: 'Not observed in the previous sessions — likely a regression or newly-reachable code path.',
            sessionCount: 1,
            totalOccurrences: ne.count,
            firstSeen: sessionFilename,
            lastSeen: sessionFilename,
            severity: 'high' as SignalSeverity,
            recurring: false,
            timeline: [{ session: sessionFilename, count: ne.count }],
        });
    }
    for (const de of detection.disappearingErrors.slice(0, cap)) {
        out.push({
            kind: 'error',
            fingerprint: `regression::recovered::${de.hash}`,
            label: `✅ Resolved (last seen ${de.sessionsAgo} session${de.sessionsAgo === 1 ? '' : 's'} ago): ${de.example}`,
            detail: `This error appeared in ${de.lastSeenSession} but has not reoccurred. Likely fixed.`,
            sessionCount: 0,
            totalOccurrences: 0,
            firstSeen: de.lastSeenSession,
            lastSeen: de.lastSeenSession,
            severity: 'low' as SignalSeverity,
            recurring: false,
            timeline: [],
        });
    }
    return out;
}
