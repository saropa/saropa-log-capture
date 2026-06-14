/**
 * Code freshness classification (cross-session-analysis idea #12).
 *
 * Turns "when was this file last committed" into a coarse freshness tier so it can be overlaid on
 * the hot-file (most-logged) list. A file that is both frequently logged AND recently changed is a
 * prime suspect — that intersection is where churn meets noise. The mention count comes from the
 * cross-session aggregator; this module owns only the recency → tier mapping.
 *
 * Pure (no vscode import, `now` injected) so the tier and day math are unit-testable under
 * `node --test`. The host resolves each hot file to a workspace path, reads its last commit date,
 * and calls these to label the row.
 */

/** Freshness band by days since the last commit. 'unknown' = no commit date resolved. */
export type FreshnessTier = 'recent' | 'moderate' | 'stale' | 'unknown';

/** At/under this many days the file is "recent" (red — actively churning). */
const RECENT_MAX_DAYS = 7;
/** At/under this many days the file is "moderate" (amber); beyond it, "stale" (green). */
const MODERATE_MAX_DAYS = 30;

/** Milliseconds in a day, for the date math. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days between a `YYYY-MM-DD` commit date and `now` (ms). Returns undefined for an
 * unparseable date so the caller can fall back to the 'unknown' tier. Negative spans (a commit
 * dated in the future, e.g. clock skew) clamp to 0 rather than reporting a negative age.
 */
export function daysSinceCommitDate(dateYmd: string, nowMs: number): number | undefined {
    // Parse as UTC midnight so the day count doesn't drift with the local timezone.
    const parsed = Date.parse(`${dateYmd}T00:00:00Z`);
    if (Number.isNaN(parsed)) { return undefined; }
    return Math.max(0, Math.floor((nowMs - parsed) / DAY_MS));
}

/** Map days-since-commit to a freshness tier; undefined days → 'unknown'. */
export function classifyFreshness(daysSinceCommit: number | undefined): FreshnessTier {
    if (daysSinceCommit === undefined) { return 'unknown'; }
    if (daysSinceCommit <= RECENT_MAX_DAYS) { return 'recent'; }
    if (daysSinceCommit <= MODERATE_MAX_DAYS) { return 'moderate'; }
    return 'stale';
}
