/**
 * Pure correlation for the per-line database-query badge (no vscode/fs imports).
 * Maps captured content lines to a count of correlated DB queries by request ID
 * only — a deliberate, precise choice. Timestamp-only correlation is left to the
 * on-demand "Related queries" popover; badging every line within the time window
 * would be noise, and a bare timestamp rarely maps to a single line anyway.
 */

import { boundForUserRegex } from '../../misc/regex-safety';

/** Map of content-line index -> number of correlated DB queries, for the viewer badge. */
export type DatabaseQueryLineCounts = Record<number, number>;

/** Tally how many queries in the sidecar carry each request ID. */
function tallyRequestIds(queries: readonly unknown[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const q of queries) {
        const id = q && typeof q === 'object' ? (q as Record<string, unknown>).requestId : undefined;
        if (typeof id === 'string' && id) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
    }
    return counts;
}

/**
 * Flag content lines whose extracted request ID matches a query's request ID,
 * returning index -> matched-query-count. Returns {} when the pattern is empty
 * or invalid, or when no query carries a request ID.
 */
export function databaseQueryLineCounts(
    contentLines: readonly string[],
    queries: readonly unknown[],
    requestIdPattern: string,
): DatabaseQueryLineCounts {
    if (!requestIdPattern) { return {}; }
    const counts = tallyRequestIds(queries);
    if (counts.size === 0) { return {}; }

    let requestIdRe: RegExp;
    // A user-supplied pattern can be malformed; a bad regex must not break loading.
    try { requestIdRe = new RegExp(requestIdPattern, 'i'); } catch { return {}; }

    const result: DatabaseQueryLineCounts = {};
    for (let i = 0; i < contentLines.length; i++) {
        const m = requestIdRe.exec(boundForUserRegex(contentLines[i]));
        const id = m ? (m[1] ?? m[0]) : undefined;
        if (id && counts.has(id)) {
            result[i] = counts.get(id) as number;
        }
    }
    return result;
}
