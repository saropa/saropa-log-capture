/** Thread-aware formatting for stack traces in bug reports. */

import type { StackFrame } from './bug-report-collector';

/** Group consecutive frames by threadName, preserving order. */
export function groupFramesByThread(frames: readonly StackFrame[]): [string | undefined, StackFrame[]][] {
    const groups: [string | undefined, StackFrame[]][] = [];
    let current: [string | undefined, StackFrame[]] | undefined;
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
export function formatThreadGroupedLines(frames: readonly StackFrame[]): string[] {
    const groups = groupFramesByThread(frames);
    const multiThread = groups.length > 1 && groups.some(([name]) => name !== undefined);
    if (!multiThread) {
        return frames.map(f => f.isApp ? `>>> ${f.text}` : `    ${f.text}`);
    }
    const lines: string[] = [];
    for (const [name, groupFrames] of groups) {
        if (name) { lines.push(`--- ${name} ---`); }
        for (const f of groupFrames) {
            lines.push(f.isApp ? `>>> ${f.text}` : `    ${f.text}`);
        }
    }
    return lines;
}
