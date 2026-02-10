/** Thread dump detection and grouping for the log viewer line pipeline. */

import { stripAnsi, escapeHtml } from '../modules/ansi';
import { parseThreadHeader, isStackFrameLine } from '../modules/stack-parser';
import type { PendingLine } from './viewer-file-loader';

interface ThreadGroup {
    readonly header: PendingLine;
    readonly frames: PendingLine[];
}

/** Mutable state tracking an in-progress thread dump. */
export interface ThreadDumpState {
    groups: ThreadGroup[];
    current: ThreadGroup | undefined;
}

/** Create a fresh thread dump tracking state. */
export function createThreadDumpState(): ThreadDumpState {
    return { groups: [], current: undefined };
}

/**
 * Process a line through thread dump detection.
 * Either buffers the line (if part of a thread dump) or pushes it to pending.
 * Call `flushThreadDump()` on session end to emit any remaining buffered lines.
 */
export function processLineForThreadDump(
    state: ThreadDumpState, line: PendingLine, rawText: string, pending: PendingLine[],
): void {
    if (line.isMarker) { flushThreadDump(state, pending); pending.push(line); return; }
    const stripped = stripAnsi(rawText);
    const isHeader = parseThreadHeader(stripped) !== undefined;
    const isFrame = isStackFrameLine(stripped);
    if (isHeader) {
        if (state.current) { state.groups.push(state.current); }
        state.current = { header: line, frames: [] };
    } else if (isFrame && state.current) {
        state.current.frames.push(line);
    } else {
        flushThreadDump(state, pending);
        pending.push(line);
    }
}

/** Flush any buffered thread dump groups to pending lines. */
export function flushThreadDump(state: ThreadDumpState, pending: PendingLine[]): void {
    if (state.current) { state.groups.push(state.current); state.current = undefined; }
    if (state.groups.length === 0) { return; }
    if (state.groups.length >= 2) {
        pending.push(buildSummaryLine(state.groups.length));
    }
    for (const g of state.groups) {
        pending.push(g.header);
        for (const f of g.frames) { pending.push(f); }
    }
    state.groups = [];
}

function buildSummaryLine(threadCount: number): PendingLine {
    const label = `Thread dump (${threadCount} threads)`;
    return {
        text: `<span class="thread-dump-summary">${escapeHtml(label)}</span>`,
        isMarker: true, lineCount: 0, category: '', timestamp: 0,
    };
}
