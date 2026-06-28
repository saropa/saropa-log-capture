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
import { buildLogLineHtmlWithOptionalDriftArgsDim } from "../../modules/db/drift-log-line-args-fold";
import type { DiagnosticCache } from "../../modules/diagnostics/diagnostic-cache";
import { LineData } from "../../modules/session/session-manager";
import { linkifyBarePaths, linkifyRelativePaths } from "../../modules/source/source-linker";
import { type PendingLine } from "../viewer/viewer-file-loader";
import { type ThreadDumpState, processLineForThreadDump, flushThreadDump } from "../viewer/viewer-thread-grouping";
import * as helpers from "./viewer-provider-helpers";

const BATCH_INTERVAL_MS = 200;
// When the staging queue is backlogged we flush MORE often, not less. The old
// value (500ms — slower than normal) was anti-backpressure: it halved drain
// throughput exactly when the queue was growing, so any sustained arrival rate
// above the slowed drain rate let pendingLines run away to the ~4GB V8 heap
// ceiling and crash the extension host (bug 001). A shorter interval raises
// drain capacity under load; payload size stays bounded by MAX_LINES_PER_BATCH.
const BATCH_INTERVAL_UNDER_LOAD_MS = 50;
const BATCH_BACKLOG_THRESHOLD = 1000;

// Hard ceiling on the un-flushed staging queue. The webview is a separate
// renderer; if the extension host appends faster than it can post+drain (a
// high-rate logcat/DB firehose), an uncapped queue grows until the host hits
// the ~4GB V8 heap limit and V8 aborts — taking the Dart debug adapter (and the
// user's debug session) with it. The full stream is still on disk in the
// session log, so dropping the OLDEST un-posted lines loses nothing durable.
export const MAX_PENDING_LINES = 20_000;
// Once at the cap, drop a chunk past it (not one line per append) so the O(n)
// splice runs rarely instead of on every subsequent append at the ceiling.
const PENDING_DROP_CHUNK = 1_000;

/** Mutable state needed by the batch timer and addLine. */
export interface BatchTarget {
    pendingLines: PendingLine[];
    batchTimer: ReturnType<typeof setTimeout> | undefined;
    threadDumpState: ThreadDumpState;
    getView(): { readonly visible: boolean } | undefined;
    getSeenCategories(): Set<string>;
    postMessage(message: unknown): void;
    /**
     * Count of live lines dropped by the backlog cap since the last flush.
     * Accumulated by capPendingLines, surfaced as one notice marker by
     * maybeEmitDropNotice, then reset. Optional so existing targets need no
     * change; treated as 0 when absent.
     */
    droppedLiveLines?: number;
}

/**
 * Build one viewer line from raw capture (ANSI, links, thread header styling, framework/coverage).
 * Shared so ViewerBroadcaster can build once and fan out to sidebar + pop-out.
 */
export function buildPendingLineFromLineData(
    data: LineData,
    diagnosticCache?: DiagnosticCache,
): PendingLine {
    let html = data.isMarker ? escapeHtml(data.text) : buildLogLineHtmlWithOptionalDriftArgsDim(data.text);
    if (!data.isMarker) { html = helpers.tryFormatThreadHeader(data.text, html); }
    // AI activity rows (Claude Code [AI Edit] / [AI Read] / [AI Write]) surface
    // bare absolute paths with no `:line` tail, so linkifyHtml (called inside
    // buildLogLineHtmlWithOptionalDriftArgsDim) leaves them as plain text. The
    // bare-path pass only fires for ai-* categories to avoid linkifying prose
    // mentions ("see lib/foo.dart for context") on regular log lines.
    // linkifyRelativePaths picks up project-folder-anchored paths like
    // `lib/components/x.dart` that tool output (git, dart analyze) emits with
    // no absolute root AND no :line tail — those slipped through both
    // linkifyHtml (no :line) and linkifyBarePaths (no absolute root) before.
    if (!data.isMarker && data.category && data.category.startsWith('ai-')) {
        html = linkifyBarePaths(html);
        html = linkifyRelativePaths(html);
    }
    const tier = helpers.classifyFrame(data.text);
    const fw = tier !== undefined ? tier !== 'flutter' : undefined;
    const qualityPercent = data.isMarker ? undefined : helpers.lookupQuality(data.text, tier);
    const lint = (!data.isMarker && diagnosticCache)
        ? diagnosticCache.lookupForLine(data.sourcePath, data.sourceLine, data.text)
        : undefined;
    return {
        text: html, rawText: data.text,
        isMarker: data.isMarker, lineCount: data.lineCount,
        category: data.category, timestamp: data.timestamp.getTime(),
        tier, fw, sourcePath: data.sourcePath,
        ...(data.logFileUri !== undefined ? { logFileUri: data.logFileUri } : {}),
        ...(qualityPercent !== undefined ? { qualityPercent } : {}),
        ...(lint?.errors ? { lintErrors: lint.errors } : {}),
        ...(lint?.warnings ? { lintWarnings: lint.warnings } : {}),
    };
}

/** Append a pre-built line to the pending queue (per-viewer thread-dump state). */
export function appendLiveLineToBatch(target: BatchTarget, line: PendingLine, rawText: string): void {
    if (!target.getView()?.visible) { return; }
    processLineForThreadDump(target.threadDumpState, line, rawText, target.pendingLines);
    capPendingLines(target);
}

/**
 * Enforce MAX_PENDING_LINES by dropping the OLDEST un-posted lines when the
 * queue overflows. Oldest is safe to drop: those lines have not reached the
 * webview yet, and the full stream is already persisted to the session log
 * file, so nothing durable is lost. The dropped count is accumulated and
 * surfaced as a single marker on the next flush (maybeEmitDropNotice).
 */
function capPendingLines(target: BatchTarget): void {
    if (target.pendingLines.length <= MAX_PENDING_LINES) { return; }
    const overflow = target.pendingLines.length - MAX_PENDING_LINES;
    const drop = overflow + PENDING_DROP_CHUNK;
    target.pendingLines.splice(0, drop);
    target.droppedLiveLines = (target.droppedLiveLines ?? 0) + drop;
}

/**
 * If lines were dropped by the backlog cap, prepend ONE notice marker to the
 * front of the queue — the gap sits at the oldest (front) end, where the drop
 * happened — and reset the counter so the notice is emitted exactly once per
 * drop event. Mirrors EarlyOutputBuffer's drop notice.
 */
function maybeEmitDropNotice(target: BatchTarget): void {
    const dropped = target.droppedLiveLines ?? 0;
    if (dropped === 0) { return; }
    target.droppedLiveLines = 0;
    target.pendingLines.unshift(buildDropNoticeMarker(dropped));
}

function buildDropNoticeMarker(dropped: number): PendingLine {
    const noun = dropped === 1 ? 'line' : 'lines';
    // Log-content marker (English, like EarlyOutputBuffer's notice) — a technical
    // artifact in the captured stream, not UI chrome, so it is not localized.
    const text = `[Saropa Log Capture] ${dropped} live ${noun} dropped `
        + `(viewer backlog cap ${MAX_PENDING_LINES} reached; full stream is in the session log file).`;
    return { text: escapeHtml(text), rawText: text, isMarker: true, lineCount: 0, category: 'console', timestamp: 0 };
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
    maybeEmitDropNotice(target);
    helpers.flushBatch(
        target.pendingLines,
        !!target.getView(),
        (msg) => target.postMessage(msg),
        (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), (msg) => target.postMessage(msg)),
    );
}

/**
 * Flush interval selector. Under backlog, flush FASTER (smaller delay) so the
 * consumer drains quicker — the inverse of the original logic, which slowed the
 * flush under load and let the queue run away to the V8 heap ceiling (bug 001).
 * Exported for the cadence regression test.
 */
export function computeBatchDelay(pendingCount: number): number {
    return pendingCount > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
}

function scheduleNextBatch(target: BatchTarget): void {
    if (!target.getView()) { return; }
    const delay = computeBatchDelay(target.pendingLines.length);
    target.batchTimer = setTimeout(() => {
        target.batchTimer = undefined;
        maybeEmitDropNotice(target);
        helpers.flushBatch(
            target.pendingLines,
            !!target.getView(),
            (msg) => target.postMessage(msg),
            (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), (msg) => target.postMessage(msg)),
        );
        scheduleNextBatch(target);
    }, delay);
}
