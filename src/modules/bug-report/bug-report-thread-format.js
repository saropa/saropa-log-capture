"use strict";
/** Thread-aware formatting for stack traces in bug reports. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupFramesByThread = groupFramesByThread;
exports.formatThreadGroupedLines = formatThreadGroupedLines;
/** Group consecutive frames by threadName, preserving order. */
function groupFramesByThread(frames) {
    const groups = [];
    let current;
    for (const f of frames) {
        if (!current || current[0] !== f.threadName) {
            current = [f.threadName, []];
            groups.push(current);
        }
        current[1].push(f);
    }
    return groups;
}
/** Format stack frames with thread separators when multiple threads are present. */
function formatThreadGroupedLines(frames) {
    const groups = groupFramesByThread(frames);
    const multiThread = groups.length > 1 && groups.some(([name]) => name !== undefined);
    if (!multiThread) {
        return frames.map(f => f.isApp ? `>>> ${f.text}` : `    ${f.text}`);
    }
    const lines = [];
    for (const [name, groupFrames] of groups) {
        if (name) {
            lines.push(`--- ${name} ---`);
        }
        for (const f of groupFrames) {
            lines.push(f.isApp ? `>>> ${f.text}` : `    ${f.text}`);
        }
    }
    return lines;
}
//# sourceMappingURL=bug-report-thread-format.js.map