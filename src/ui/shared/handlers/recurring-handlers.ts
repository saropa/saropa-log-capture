/**
 * Recurring Errors Handlers
 *
 * Handlers for recurring errors panel operations.
 */

import { aggregateInsights } from '../../../modules/misc/cross-session-aggregator';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../../../modules/misc/error-status-store';
import type { PostFn } from './crashlytics-handlers';

/** Aggregate recurring errors and send to webview. */
export async function handleRecurringRequest(post: PostFn): Promise<void> {
    const insights = await aggregateInsights('all').catch(() => undefined);
    const errors = insights?.recurringErrors ?? [];
    const statuses = await getErrorStatusBatch(errors.map(e => e.hash));
    post({ type: 'recurringErrorsData', errors, statuses });
}

/** Update error status and refresh. */
export async function handleSetErrorStatus(hash: string, status: string, post: PostFn): Promise<void> {
    await setErrorStatus(hash, status as ErrorStatus);
    await handleRecurringRequest(post);
}
