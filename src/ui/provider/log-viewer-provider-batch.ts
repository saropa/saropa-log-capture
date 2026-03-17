/**
 * Live-line batching for LogViewerProvider.
 * Handles addLine processing, batch timer, and periodic flush.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */

import { ansiToHtml, escapeHtml } from "../../modules/capture/ansi";
import { linkifyHtml, linkifyUrls } from "../../modules/source/source-linker";
import { LineData } from "../../modules/session/session-manager";
import { type PendingLine } from "../viewer/viewer-file-loader";
import { type ThreadDumpState, processLineForThreadDump, flushThreadDump } from "../viewer/viewer-thread-grouping";
import * as helpers from "./viewer-provider-helpers";

const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;

/** Mutable state needed by the batch timer and addLine. */
export interface BatchTarget {
    pendingLines: PendingLine[];
    batchTimer: ReturnType<typeof setTimeout> | undefined;
    threadDumpState: ThreadDumpState;
    getView(): { readonly visible: boolean } | undefined;
    getSeenCategories(): Set<string>;
    postMessage(message: unknown): void;
}

/** Queue a live line for the next batch flush. */
export function addLineToBatch(target: BatchTarget, data: LineData): void {
    if (!target.getView()?.visible) { return; }
    let html = data.isMarker ? escapeHtml(data.text) : linkifyUrls(linkifyHtml(ansiToHtml(data.text)));
    if (!data.isMarker) { html = helpers.tryFormatThreadHeader(data.text, html); }
    const fw = helpers.classifyFrame(data.text);
    const qualityPercent = data.isMarker ? undefined : helpers.lookupQuality(data.text, fw);
    const line: PendingLine = {
        text: html, isMarker: data.isMarker, lineCount: data.lineCount,
        category: data.category, timestamp: data.timestamp.getTime(),
        fw, sourcePath: data.sourcePath,
        ...(qualityPercent !== undefined ? { qualityPercent } : {}),
    };
    processLineForThreadDump(target.threadDumpState, line, data.text, target.pendingLines);
}

/** Start the periodic batch flush timer. */
export function startBatchTimer(target: BatchTarget): void {
    stopBatchTimer(target);
    scheduleNextBatch(target);
}

/** Stop the periodic batch flush timer. */
export function stopBatchTimer(target: BatchTarget): void {
    if (target.batchTimer !== undefined) {
        clearTimeout(target.batchTimer);
        target.batchTimer = undefined;
    }
}

/** Flush pending lines and clear the thread-dump accumulator. */
export function flushPendingBatch(target: BatchTarget): void {
    flushThreadDump(target.threadDumpState, target.pendingLines);
    helpers.flushBatch(
        target.pendingLines,
        !!target.getView(),
        (msg) => target.postMessage(msg),
        (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), (msg) => target.postMessage(msg)),
    );
}

function scheduleNextBatch(target: BatchTarget): void {
    if (!target.getView()) { return; }
    const delay = target.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
    target.batchTimer = setTimeout(() => {
        target.batchTimer = undefined;
        helpers.flushBatch(
            target.pendingLines,
            !!target.getView(),
            (msg) => target.postMessage(msg),
            (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), (msg) => target.postMessage(msg)),
        );
        scheduleNextBatch(target);
    }, delay);
}
