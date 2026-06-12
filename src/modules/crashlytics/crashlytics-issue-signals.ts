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

/** True when the issue has been seen in more than one app version (both versions known and differing). */
export function isRepetitive(issue: CrashlyticsIssue): boolean {
    return Boolean(issue.firstVersion && issue.lastVersion && issue.firstVersion !== issue.lastVersion);
}

/** Return the issues with locally-derived signals set. Pure; does not mutate the inputs. */
export function deriveIssueSignals(issues: readonly CrashlyticsIssue[]): CrashlyticsIssue[] {
    return issues.map(issue => ({ ...issue, repetitive: isRepetitive(issue) }));
}
