/**
 * Batch timer management for the pop-out panel.
 * Schedules periodic flushes of pending lines to the webview.
 * Extracted from pop-out-panel.ts to keep the file under the line limit.
 */

import type { PendingLine } from "../viewer/viewer-file-loader";
import * as helpers from "../provider/viewer-provider-helpers";

const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;

/** Minimal interface for the batch timer target. */
export interface PopOutBatchTarget {
    pendingLines: PendingLine[];
    batchTimer: ReturnType<typeof setTimeout> | undefined;
    getPanel(): { readonly webview: { postMessage(m: unknown): Thenable<boolean> } } | undefined;
    getSeenCategories(): Set<string>;
}

/** Start the periodic batch flush timer. */
export function startPopOutBatchTimer(target: PopOutBatchTarget): void {
    stopPopOutBatchTimer(target);
    scheduleNextBatch(target);
}

/** Stop the periodic batch flush timer. */
export function stopPopOutBatchTimer(target: PopOutBatchTarget): void {
    if (target.batchTimer !== undefined) {
        clearTimeout(target.batchTimer);
        target.batchTimer = undefined;
    }
}

function scheduleNextBatch(target: PopOutBatchTarget): void {
    if (!target.getPanel()) { return; }
    const delay = target.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
    target.batchTimer = setTimeout(() => {
        target.batchTimer = undefined;
        flushBatch(target);
        scheduleNextBatch(target);
    }, delay);
}

function flushBatch(target: PopOutBatchTarget): void {
    const post = (m: unknown) => target.getPanel()?.webview.postMessage(m);
    helpers.flushBatch(target.pendingLines, !!target.getPanel(), post,
        (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), post));
}
