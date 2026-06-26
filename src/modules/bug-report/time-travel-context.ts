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

/** Render the largest-pause note from an already-found gap (shared by the standalone note). */
function formatGap(gap: ContextGap): string {
    const seconds = (gap.gapMs / 1000).toFixed(1);
    return `⏱ Largest pause in this context: ${seconds}s before \`${truncate(gap.afterLine)}\``;
}

/**
 * One-line markdown note about the largest pause, or '' when there is nothing notable to say.
 * English by design — it feeds the markdown bug report.
 */
export function formatContextGapNote(lines: readonly string[]): string {
    const gap = findLargestContextGap(lines);
    return gap ? formatGap(gap) : '';
}

// ── Smart Context Boundaries (cross-session-analysis idea #1) ────────────────
//
// A refinement of the pause note above: rather than treating the pre-error window as a flat block
// of N lines, walk backward from the error to find where the *logical operation it belongs to*
// actually began. The boundary is the nearest separator scanning back from the newest line —
// a blank line, a timestamp gap, or (weakest) a rise in severity. Context before that boundary is
// a different operation and is less likely to be relevant. The existing fixed window stays the
// fallback: when no boundary is detected the report shows the full window unchanged (this only
// *annotates* where the operation starts, it never shrinks what is displayed).

/** A coarse, structural severity token — NOT the config-driven severity classifier. */
type CoarseLevel = 'error' | 'warn' | 'info' | 'debug' | undefined;

/**
 * Read a line's structural level from its head token (logcat prefix, `[level]` tag, or `LEVEL:`
 * label). Deliberately structural and config-free so the helper stays pure and node:test-able and
 * so the boundary doesn't drift when a user edits their severity keywords. A line with no head
 * token is `undefined` and never triggers a transition on its own. The leading timestamp prefix is
 * stripped first (reusing {@link extractTimestamp}) so `[14:32] ERROR …` still reads as `error`.
 */
function coarseLevel(line: string): CoarseLevel {
    const text = (extractTimestamp(line)?.rest ?? line).trimStart();
    const logcat = /^([VDIWEFA])\//.exec(text);
    if (logcat) {
        const c = logcat[1];
        if (c === 'E' || c === 'F' || c === 'A') { return 'error'; }
        if (c === 'W') { return 'warn'; }
        if (c === 'I') { return 'info'; }
        return 'debug'; // V, D
    }
    if (/^\[(?:error|fatal|panic|exception)\]/i.test(text)) { return 'error'; }
    if (/^\[warn(?:ing)?\]/i.test(text)) { return 'warn'; }
    if (/^\[info\]/i.test(text)) { return 'info'; }
    if (/^\[(?:debug|trace|verbose)\]/i.test(text)) { return 'debug'; }
    const label = /^(error|fatal|warn(?:ing)?|info|debug|trace)\b\s*[:|\-]/i.exec(text);
    if (label) {
        const l = label[1].toLowerCase();
        if (l === 'error' || l === 'fatal') { return 'error'; }
        if (l.startsWith('warn')) { return 'warn'; }
        if (l === 'info') { return 'info'; }
        return 'debug';
    }
    return undefined;
}

/** True when severity rises from prev→cur (info/debug → warn/error): entering an elevated region. */
function isEscalation(prev: CoarseLevel, cur: CoarseLevel): boolean {
    const lowered = prev === 'info' || prev === 'debug';
    const raised = cur === 'warn' || cur === 'error';
    return lowered && raised;
}

/** The detected start of the operation the error belongs to. */
export interface ContextBoundary {
    /** Index into the input lines of the first line of the operation. */
    readonly startIndex: number;
    /** What placed the boundary here. */
    readonly reason: 'blank' | 'gap' | 'level';
    /** Pause in milliseconds, present only when `reason === 'gap'`. */
    readonly gapMs?: number;
}

/**
 * Walk backward from the newest line and return the start of the most recent operation. Blank
 * lines and timestamp gaps are strong separators (nearest one wins); a severity escalation is a
 * weak fallback used only when no strong separator exists — line-to-line level flips are too noisy
 * to treat as boundaries. Returns undefined for <2 lines or when nothing separates the window.
 */
export function findContextBoundary(lines: readonly string[]): ContextBoundary | undefined {
    let escalation: ContextBoundary | undefined;
    for (let i = lines.length - 1; i >= 1; i--) {
        const prev = lines[i - 1];
        const cur = lines[i];
        // Blank previous line = explicit operation separator (strongest, nearest wins).
        if (prev.trim() === '') { return { startIndex: i, reason: 'blank' }; }
        // Timestamp gap between the two timed lines (the operation resumed at `cur`).
        const prevTs = extractTimestamp(prev)?.timestamp;
        const curTs = extractTimestamp(cur)?.timestamp;
        if (prevTs !== undefined && curTs !== undefined) {
            const gapMs = curTs - prevTs;
            if (gapMs >= GAP_THRESHOLD_MS) { return { startIndex: i, reason: 'gap', gapMs }; }
        }
        // Record the nearest escalation, but keep scanning for a strong separator further back.
        if (!escalation && isEscalation(coarseLevel(prev), coarseLevel(cur))) {
            escalation = { startIndex: i, reason: 'level' };
        }
    }
    return escalation;
}

/** Render the boundary as a one-line markdown note (English by design, like the pause note). */
function formatBoundary(boundary: ContextBoundary, lines: readonly string[]): string {
    const back = lines.length - boundary.startIndex;
    const plural = back === 1 ? '' : 's';
    const startLine = truncate(lines[boundary.startIndex].trim());
    let why: string;
    if (boundary.reason === 'gap') {
        why = `after a ${(boundary.gapMs! / 1000).toFixed(1)}s pause`;
    } else if (boundary.reason === 'blank') {
        why = 'blank-line separator';
    } else {
        why = 'severity rises here';
    }
    return `⎯ Operation boundary: the failing operation begins ${back} line${plural} back ` +
        `(${why}), at \`${startLine}\``;
}

/**
 * The combined Log Context insight notes: the operation-boundary note (idea #1) plus the
 * largest-pause note (idea #15), with the pause note suppressed when the boundary already reports
 * that same pause — so the report never states one gap twice. Returns 0–2 markdown lines.
 */
export function formatContextInsights(lines: readonly string[]): string[] {
    const notes: string[] = [];
    const boundary = findContextBoundary(lines);
    if (boundary) { notes.push(formatBoundary(boundary, lines)); }
    const gap = findLargestContextGap(lines);
    const boundaryFoldsGap = boundary?.reason === 'gap' && boundary.gapMs === gap?.gapMs;
    if (gap && !boundaryFoldsGap) { notes.push(formatGap(gap)); }
    return notes;
}
