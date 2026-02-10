/** Thread dump detection, grouping, and ANR pattern analysis for the log viewer line pipeline. */

import { stripAnsi, escapeHtml } from '../modules/ansi';
import { parseThreadHeader, isStackFrameLine } from '../modules/stack-parser';
import type { PendingLine } from './viewer-file-loader';

interface ThreadGroup {
    readonly header: PendingLine;
    readonly rawHeader: string;
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
        state.current = { header: line, rawHeader: stripped, frames: [] };
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
    const blockers = state.groups.length >= 2 ? detectAnrPattern(state.groups) : new Set<number>();
    if (state.groups.length >= 2) {
        pending.push(buildSummaryLine(state.groups.length, blockers.size > 0));
    }
    for (let i = 0; i < state.groups.length; i++) {
        const g = state.groups[i];
        pending.push(blockers.has(i) ? annotateBlocker(g.header) : g.header);
        for (const f of g.frames) { pending.push(f); }
    }
    state.groups = [];
}

/** Thread states that indicate blocking or contention. */
const blockingStates = new Set(['waiting', 'blocked', 'timedwaiting', 'timed_waiting', 'monitor']);

/** Detect ANR pattern: main thread Runnable while other threads hold locks. */
function detectAnrPattern(groups: readonly ThreadGroup[]): Set<number> {
    let mainRunnable = false;
    for (const g of groups) {
        const h = parseThreadHeader(g.rawHeader);
        if (h && isMainThread(h.name) && h.state?.toLowerCase() === 'runnable') { mainRunnable = true; break; }
    }
    if (!mainRunnable) { return new Set(); }
    const blockers = new Set<number>();
    for (let i = 0; i < groups.length; i++) {
        const h = parseThreadHeader(groups[i].rawHeader);
        if (!h || isMainThread(h.name)) { continue; }
        if (h.state && blockingStates.has(h.state.toLowerCase())) { blockers.add(i); }
    }
    return blockers;
}

function isMainThread(name: string): boolean {
    const lower = name.toLowerCase();
    return lower === 'main' || lower === 'ui' || lower === 'main thread';
}

function annotateBlocker(header: PendingLine): PendingLine {
    return { ...header, text: `<span class="anr-badge" title="Potential ANR blocker">\u26a0</span> ${header.text}` };
}

function buildSummaryLine(threadCount: number, hasAnr: boolean): PendingLine {
    const label = hasAnr
        ? `Thread dump (${threadCount} threads) \u26a0 ANR pattern detected`
        : `Thread dump (${threadCount} threads)`;
    const cls = hasAnr ? 'thread-dump-summary anr-warning' : 'thread-dump-summary';
    return {
        text: `<span class="${cls}">${escapeHtml(label)}</span>`,
        isMarker: true, lineCount: 0, category: '', timestamp: 0,
    };
}
