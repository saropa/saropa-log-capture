/**
 * Live-line batching for LogViewerProvider and PopOutPanel.
 *
 * **Central contract:** `buildPendingLineFromLineData` turns one `LineData` into HTML (`PendingLine`)
 * (ANSI, links, thread-header styling, framework/coverage). `ViewerBroadcaster.addLine` calls this
 * **once per line** and fans out copies to each `ViewerTarget` via `appendLiveLineFromBroadcast`, so
 * sidebar + pop-out do not duplicate that work. Thread-dump grouping (`processLineForThreadDump`) still
 * runs per target because each webview has its own `threadDumpState` and `pendingLines` queue.
 *
 * **Timers:** `startBatchTimer` / `scheduleNextBatch` flush pending lines to the webview on an interval;
 * `flushPendingBatch` also flushes buffered thread-dump groups before posting.
 */

import { escapeHtml } from "../../modules/capture/ansi";
import { buildLogLineHtmlWithOptionalDriftArgsFold } from "../../modules/db/drift-log-line-args-fold";
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

/**
 * Build one viewer line from raw capture (ANSI, links, thread header styling, framework/coverage).
 * Shared so ViewerBroadcaster can build once and fan out to sidebar + pop-out.
 */
export function buildPendingLineFromLineData(data: LineData): PendingLine {
    let html = data.isMarker ? escapeHtml(data.text) : buildLogLineHtmlWithOptionalDriftArgsFold(data.text);
    if (!data.isMarker) { html = helpers.tryFormatThreadHeader(data.text, html); }
    const fw = helpers.classifyFrame(data.text);
    const qualityPercent = data.isMarker ? undefined : helpers.lookupQuality(data.text, fw);
    return {
        text: html, isMarker: data.isMarker, lineCount: data.lineCount,
        category: data.category, timestamp: data.timestamp.getTime(),
        fw, sourcePath: data.sourcePath,
        ...(qualityPercent !== undefined ? { qualityPercent } : {}),
    };
}

/** Append a pre-built line to the pending queue (per-viewer thread-dump state). */
export function appendLiveLineToBatch(target: BatchTarget, line: PendingLine, rawText: string): void {
    if (!target.getView()?.visible) { return; }
    processLineForThreadDump(target.threadDumpState, line, rawText, target.pendingLines);
}

/** Queue a live line for the next batch flush (build + append). */
export function addLineToBatch(target: BatchTarget, data: LineData): void {
    appendLiveLineToBatch(target, buildPendingLineFromLineData(data), data.text);
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
