/**
 * Extension-side handler for error hover popup data requests.
 *
 * Computes fingerprint, looks up cross-session history and triage status,
 * then posts enriched data back to the webview for the hover popup.
 */

import { normalizeLine, hashFingerprint, classifyCategory, type CrashCategory } from '../../../modules/analysis/error-fingerprint';
import { aggregateInsights, type RecurringError } from '../../../modules/misc/cross-session-aggregator';
import { getErrorStatusBatch, type ErrorStatus } from '../../../modules/misc/error-status-store';
import type { PostFn } from './crashlytics-handlers';

/** Hover data sent back to the webview. */
export interface ErrorHoverData {
    readonly lineIndex: number;
    readonly hash: string;
    readonly normalizedText: string;
    readonly crashCategory: CrashCategory;
    readonly triageStatus: ErrorStatus;
    readonly sessionCount: number;
    readonly totalOccurrences: number;
    readonly firstSeen: string | undefined;
    readonly lastSeen: string | undefined;
}

/**
 * Handle a hover data request from the webview.
 * Computes fingerprint, fetches cross-session data, and posts back.
 */
export async function handleErrorHoverRequest(
    text: string,
    lineIndex: number,
    post: PostFn,
): Promise<void> {
    const normalized = normalizeLine(text);
    if (normalized.length < 5) {
        post({ type: 'errorHoverData', lineIndex, empty: true });
        return;
    }

    const hash = hashFingerprint(normalized);
    const crashCategory = classifyCategory(text);

    // Parallel: cross-session lookup + triage status
    const [insights, statuses] = await Promise.all([
        aggregateInsights('all').catch(() => undefined),
        getErrorStatusBatch([hash]).catch(() => ({} as Record<string, ErrorStatus>)),
    ]);

    const match: RecurringError | undefined = insights?.recurringErrors.find(e => e.hash === hash);
    const triageStatus = statuses[hash] ?? 'open';

    const data: ErrorHoverData = {
        lineIndex,
        hash,
        normalizedText: normalized,
        crashCategory,
        triageStatus,
        sessionCount: match?.sessionCount ?? 0,
        totalOccurrences: match?.totalOccurrences ?? 0,
        firstSeen: match?.firstSeen,
        lastSeen: match?.lastSeen,
    };

    post({ type: 'errorHoverData', ...data });
}
