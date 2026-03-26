"use strict";
/** Thread dump detection, grouping, and ANR pattern analysis for the log viewer line pipeline. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createThreadDumpState = createThreadDumpState;
exports.processLineForThreadDump = processLineForThreadDump;
exports.flushThreadDump = flushThreadDump;
const ansi_1 = require("../../modules/capture/ansi");
const stack_parser_1 = require("../../modules/analysis/stack-parser");
/** Create a fresh thread dump tracking state. */
function createThreadDumpState() {
    return { groups: [], current: undefined };
}
/**
 * Process a line through thread dump detection.
 * Either buffers the line (if part of a thread dump) or pushes it to pending.
 * Call `flushThreadDump()` on session end to emit any remaining buffered lines.
 */
function processLineForThreadDump(state, line, rawText, pending) {
    if (line.isMarker) {
        flushThreadDump(state, pending);
        pending.push(line);
        return;
    }
    const stripped = (0, ansi_1.stripAnsi)(rawText);
    const isHeader = (0, stack_parser_1.parseThreadHeader)(stripped) !== undefined;
    const isFrame = (0, stack_parser_1.isStackFrameLine)(stripped);
    if (isHeader) {
        if (state.current) {
            state.groups.push(state.current);
        }
        state.current = { header: line, rawHeader: stripped, frames: [] };
    }
    else if (isFrame && state.current) {
        state.current.frames.push(line);
    }
    else {
        flushThreadDump(state, pending);
        pending.push(line);
    }
}
/** Flush any buffered thread dump groups to pending lines. */
function flushThreadDump(state, pending) {
    if (state.current) {
        state.groups.push(state.current);
        state.current = undefined;
    }
    if (state.groups.length === 0) {
        return;
    }
    const blockers = state.groups.length >= 2 ? detectAnrPattern(state.groups) : new Set();
    if (state.groups.length >= 2) {
        pending.push(buildSummaryLine(state.groups.length, blockers.size > 0));
    }
    for (let i = 0; i < state.groups.length; i++) {
        const g = state.groups[i];
        pending.push(blockers.has(i) ? annotateBlocker(g.header) : g.header);
        for (const f of g.frames) {
            pending.push(f);
        }
    }
    state.groups = [];
}
/** Thread states that indicate blocking or contention. */
const blockingStates = new Set(['waiting', 'blocked', 'timedwaiting', 'timed_waiting', 'monitor']);
/** Detect ANR pattern: main thread Runnable while other threads hold locks. */
function detectAnrPattern(groups) {
    let mainRunnable = false;
    for (const g of groups) {
        const h = (0, stack_parser_1.parseThreadHeader)(g.rawHeader);
        if (h && isMainThread(h.name) && h.state?.toLowerCase() === 'runnable') {
            mainRunnable = true;
            break;
        }
    }
    if (!mainRunnable) {
        return new Set();
    }
    const blockers = new Set();
    for (let i = 0; i < groups.length; i++) {
        const h = (0, stack_parser_1.parseThreadHeader)(groups[i].rawHeader);
        if (!h || isMainThread(h.name)) {
            continue;
        }
        if (h.state && blockingStates.has(h.state.toLowerCase())) {
            blockers.add(i);
        }
    }
    return blockers;
}
function isMainThread(name) {
    const lower = name.toLowerCase();
    return lower === 'main' || lower === 'ui' || lower === 'main thread';
}
function annotateBlocker(header) {
    return { ...header, text: `<span class="anr-badge" title="Potential ANR blocker">\u26a0</span> ${header.text}` };
}
function buildSummaryLine(threadCount, hasAnr) {
    const label = hasAnr
        ? `Thread dump (${threadCount} threads) \u26a0 ANR pattern detected`
        : `Thread dump (${threadCount} threads)`;
    const cls = hasAnr ? 'thread-dump-summary anr-warning' : 'thread-dump-summary';
    return {
        text: `<span class="${cls}">${(0, ansi_1.escapeHtml)(label)}</span>`,
        isMarker: true, lineCount: 0, category: '', timestamp: 0,
    };
}
//# sourceMappingURL=viewer-thread-grouping.js.map