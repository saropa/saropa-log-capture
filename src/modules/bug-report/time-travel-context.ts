/**
 * Time-travel debugging context (cross-session-analysis idea #15).
 *
 * Looks at the log lines captured just before an error and finds the largest pause between them.
 * A long gap is usually an operation boundary — the app waited on something (a network call, a
 * lock, a frame) and then the error fired. Surfacing "the error came 5.2s after the last activity"
 * tells the developer the failure followed a wait, not a burst, which narrows the cause.
 *
 * Pure (depends only on the timestamp parser, which is itself dependency-free) so it is
 * unit-testable under `node --test`. Returns undefined when no two lines carry parseable
 * timestamps or no gap reaches the threshold — the caller then adds no note.
 */

import { extractTimestamp } from '../timeline/timestamp-parser';

/** A pause shorter than this is normal interleaving, not an operation boundary worth flagging. */
const GAP_THRESHOLD_MS = 1000;

/** Longest preceding line shown in the note before truncation. */
const MAX_LINE_LENGTH = 80;

/** The largest notable pause found in the pre-error context. */
export interface ContextGap {
    /** Gap duration in milliseconds (≥ the threshold). */
    readonly gapMs: number;
    /** Text of the line immediately after the gap — what activity resumed with. */
    readonly afterLine: string;
}

/**
 * Find the largest pause (≥ threshold) between consecutive timestamped context lines. Lines
 * without a parseable timestamp are skipped for gap math but don't reset the previous timestamp,
 * so an untimed line between two timed ones doesn't hide a real gap.
 */
export function findLargestContextGap(lines: readonly string[]): ContextGap | undefined {
    let prevTs: number | undefined;
    let best: ContextGap | undefined;
    for (const line of lines) {
        // extractTimestamp (not parseTimestamp) because context lines carry a timestamp PREFIX
        // followed by the message — the anchored parseTimestamp would reject the whole line.
        const extracted = extractTimestamp(line);
        if (extracted === undefined) { continue; }
        if (prevTs !== undefined) {
            const gapMs = extracted.timestamp - prevTs;
            if (gapMs >= GAP_THRESHOLD_MS && (!best || gapMs > best.gapMs)) {
                best = { gapMs, afterLine: line.trim() };
            }
        }
        prevTs = extracted.timestamp;
    }
    return best;
}

/** Truncate a line for inline display in the note. */
function truncate(line: string): string {
    return line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH - 1) + '…' : line;
}

/**
 * One-line markdown note about the largest pause, or '' when there is nothing notable to say.
 * English by design — it feeds the markdown bug report.
 */
export function formatContextGapNote(lines: readonly string[]): string {
    const gap = findLargestContextGap(lines);
    if (!gap) { return ''; }
    const seconds = (gap.gapMs / 1000).toFixed(1);
    return `⏱ Largest pause in this context: ${seconds}s before \`${truncate(gap.afterLine)}\``;
}
