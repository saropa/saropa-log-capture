/**
 * Extension-side handler for error hover popup data requests.
 *
 * Computes fingerprint, looks up cross-session history and triage status,
 * then posts enriched data back to the webview for the hover popup.
 * Optionally includes regression hint (first-seen commit or blame for file:line).
 */

import { normalizeLine, hashFingerprint, classifyCategory, type CrashCategory } from '../../../modules/analysis/error-fingerprint';
import { aggregateSignals, type RecurringError } from '../../../modules/misc/cross-session-aggregator';
import { getErrorStatusBatch, type ErrorStatus } from '../../../modules/misc/error-status-store';
import { getRegressionHintsForError, type RegressionHintsResult } from '../../../modules/regression/regression-hint-service';
import { extractSourceReference } from '../../../modules/source/source-linker';
import { resolveSourceUri } from '../../../modules/source/source-resolver';
import { getConfig } from '../../../modules/config/config';
import type { PostFn } from './crashlytics-handlers';

/** Regression hint for error hover: "Introduced in" or "Last changed in" commit X. */
export interface ErrorHoverRegressionHint {
    readonly hash: string;
    readonly commitUrl?: string;
    readonly label: 'first-seen' | 'blame';
}

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
    readonly regressionHint?: ErrorHoverRegressionHint;
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
        aggregateSignals('all').catch(() => undefined),
        getErrorStatusBatch([hash]).catch(() => ({} as Record<string, ErrorStatus>)),
    ]);

    const match: RecurringError | undefined = insights?.recurringErrors.find(e => e.hash === hash);
    const triageStatus = statuses[hash] ?? 'open';

    const resolveUrls = getConfig().integrationsGit?.commitLinks ?? true;
    const sourceRef = extractSourceReference(text);
    const fileUri = sourceRef ? resolveSourceUri(sourceRef.filePath) : undefined;
    const hints = await getRegressionHintsForError(hash, {
        fileUri,
        line: sourceRef?.line,
        resolveCommitUrls: resolveUrls,
    }).catch((): RegressionHintsResult => ({}));

    let regressionHint: ErrorHoverRegressionHint | undefined;
    if (hints.firstSeen) {
        regressionHint = {
            hash: hints.firstSeen.hash,
            commitUrl: hints.firstSeen.commitUrl,
            label: 'first-seen',
        };
    } else if (hints.blame) {
        regressionHint = {
            hash: hints.blame.hash,
            commitUrl: hints.blame.commitUrl,
            label: 'blame',
        };
    }

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
        regressionHint,
    };

    post({ type: 'errorHoverData', ...data });
}
