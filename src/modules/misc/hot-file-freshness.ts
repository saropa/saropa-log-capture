/**
 * Host-side freshness enrichment for the hot-file list (cross-session-analysis idea #12).
 *
 * Resolves each hot file to a workspace path and reads its last git commit date, then stamps a
 * freshness tier (recent / moderate / stale) onto the entry. Kept separate from the pure
 * `code-freshness.ts` classifier because this part needs the VS Code workspace + git I/O.
 *
 * Best-effort and bounded: only the top N files (those actually shown) are enriched, and any file
 * that can't be resolved or isn't under git is simply left without a freshness tier rather than
 * failing the whole list. Git calls run in parallel.
 */

import type { HotFile } from './cross-session-aggregator';
import { findInWorkspace, getGitHistory } from './workspace-analyzer';
import { classifyFreshness, daysSinceCommitDate } from './code-freshness';

/** Only the files the panel renders are worth a git call — enriching the long tail wastes I/O. */
const ENRICH_LIMIT = 5;

/** Read one file's last-commit age in days, or undefined when unresolved / not under git. */
async function fileCommitAgeDays(filename: string, nowMs: number): Promise<number | undefined> {
    const uri = await findInWorkspace(filename).catch(() => undefined);
    if (!uri) { return undefined; }
    // maxCommits=1 → the most recent commit; its `--date=short` value is YYYY-MM-DD.
    const history = await getGitHistory(uri, 1).catch(() => []);
    const last = history[0];
    return last ? daysSinceCommitDate(last.date, nowMs) : undefined;
}

/**
 * Return a copy of the hot-file list with the top ENRICH_LIMIT entries carrying a freshness tier.
 * Entries beyond the limit, and any that can't be resolved, are returned unchanged.
 */
export async function enrichHotFilesWithFreshness(
    hotFiles: readonly HotFile[],
    nowMs: number,
): Promise<HotFile[]> {
    const head = hotFiles.slice(0, ENRICH_LIMIT);
    const tail = hotFiles.slice(ENRICH_LIMIT);
    const enrichedHead = await Promise.all(head.map(async (hf) => {
        const days = await fileCommitAgeDays(hf.filename, nowMs);
        if (days === undefined) { return hf; }
        return { ...hf, lastCommitDaysAgo: days, freshness: classifyFreshness(days) };
    }));
    return [...enrichedHead, ...tail];
}
