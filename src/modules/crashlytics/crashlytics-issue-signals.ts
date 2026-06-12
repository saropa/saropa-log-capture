/**
 * Locally-derived issue signals that the Play Developer Reporting API does NOT provide.
 *
 * Play Reporting exposes no open/closed/regression state and no Firebase-console tags, so signals like
 * "this crash recurs across releases" must be computed from the data we do hold. This module is pure
 * (no `vscode`, no I/O) so it is unit-testable and can be layered onto the mapped issues right after
 * they are fetched, leaving `mapErrorIssue` as the faithful API mapper.
 *
 * Current signals:
 * - `repetitive`: the issue spans more than one app version (firstVersion ≠ lastVersion). A crash that
 *   first appeared in an old build and is still arriving in a newer one has survived at least one
 *   release — worth flagging as recurring rather than a one-off. Derivable from a single snapshot.
 *
 * Regression detection (an issue that disappeared and came back) needs a snapshot history and is added
 * separately; it will extend this module, taking prior snapshots as an extra argument.
 */

import type { CrashlyticsIssue } from './crashlytics-types';
import type { IssueSnapshot } from './crashlytics-issue-history';

/** True when the issue has been seen in more than one app version (both versions known and differing). */
export function isRepetitive(issue: CrashlyticsIssue): boolean {
    return Boolean(issue.firstVersion && issue.lastVersion && issue.firstVersion !== issue.lastVersion);
}

/**
 * Ids of issues that REGRESSED — present now, gone in the immediately-previous snapshot, but seen in
 * some earlier snapshot (it disappeared and came back). Needs ≥3 distinct states; with fewer, nothing
 * is claimed. The history is oldest→newest and its last entry is the current state (recorded at fetch
 * time before signals are derived). Pure.
 */
export function detectRegressedIds(history: readonly IssueSnapshot[]): Set<string> {
    const regressed = new Set<string>();
    if (history.length < 3) { return regressed; }
    const ids = (s: IssueSnapshot): string[] => s.issues.map(e => e.id);
    const current = new Set(ids(history[history.length - 1]));
    const previous = new Set(ids(history[history.length - 2]));
    const earlier = new Set(history.slice(0, -2).flatMap(ids));
    // Regressed = back now, absent in the previous state, but present in some state before that.
    for (const id of current) {
        if (!previous.has(id) && earlier.has(id)) { regressed.add(id); }
    }
    return regressed;
}

/**
 * Return the issues with locally-derived signals set (`repetitive`, `regressed`). Pure; does not
 * mutate the inputs. `history` (optional) enables regression detection; without it only the
 * single-snapshot `repetitive` signal is set.
 */
export function deriveIssueSignals(
    issues: readonly CrashlyticsIssue[],
    history: readonly IssueSnapshot[] = [],
): CrashlyticsIssue[] {
    const regressedIds = detectRegressedIds(history);
    return issues.map(issue => ({
        ...issue,
        repetitive: isRepetitive(issue),
        regressed: regressedIds.has(issue.id),
    }));
}
