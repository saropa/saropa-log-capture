/**
 * Trouble Mode Crashlytics band (plan Trouble Mode dashboard, Stage 5) — pure mapper.
 *
 * Maps the cached Crashlytics issue list (read from disk, never fetched — the plan
 * forbids Trouble Mode issuing its own network call) into compact rows for the band
 * that sits above the feed. Kept vscode-free so it is unit-testable without I/O.
 *
 * Archived issues are dropped (they are the user's "don't show me again" set), the
 * busiest issues lead (sorted by event count), and the list is capped so the band
 * never grows unbounded. The row carries exactly the fields the existing Crashlytics
 * detail overlay's `meta` needs, so clicking a row reuses that overlay unchanged.
 */

import type { CrashlyticsIssue } from './crashlytics-types';

/** One compact issue row for the Trouble Mode Crashlytics band. */
export interface TroubleCrashlyticsRow {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    /** Stringified counts — the detail overlay's meta reads events/users as strings. */
    readonly events: string;
    readonly users: string;
    readonly fatal: boolean;
    readonly kind?: string;
    readonly state: string;
    readonly fv?: string;
    readonly lv?: string;
}

/** Default cap; a band of the top-N busiest issues, not the whole backlog. */
export const TROUBLE_CRASHLYTICS_ROW_CAP = 15;

/** Drop archived issues, sort busiest-first, cap, and project to the band row shape. */
export function troubleCrashlyticsRowsFromIssues(
    issues: readonly CrashlyticsIssue[],
    archivedIds: readonly string[],
    cap: number = TROUBLE_CRASHLYTICS_ROW_CAP,
): TroubleCrashlyticsRow[] {
    const archived = new Set(archivedIds);
    return issues
        .filter(i => i && !archived.has(i.id))
        .slice()
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, Math.max(0, cap))
        .map(i => ({
            id: i.id,
            title: i.title,
            subtitle: i.subtitle,
            events: String(i.eventCount),
            users: String(i.userCount),
            fatal: i.isFatal,
            kind: i.kind,
            state: i.state,
            fv: i.firstVersion,
            lv: i.lastVersion,
        }));
}
