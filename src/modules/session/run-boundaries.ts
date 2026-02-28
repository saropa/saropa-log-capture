/**
 * Detects sub-session boundaries within a log (launch, hot restart/reload, exit).
 * Used for "Prev run / Next run" navigation in the viewer.
 */

import { stripAnsi } from '../capture/ansi';

/** Kind of run boundary for display/filtering. */
export type RunBoundaryKind = 'launch' | 'hot_restart' | 'hot_reload' | 'exited';

/** A detected run boundary: line index (0-based in body) and label. */
export interface RunBoundary {
    readonly lineIndex: number;
    readonly label: string;
    readonly kind: RunBoundaryKind;
}

/** Strip optional [timestamp] [category] prefix from a log line, then strip ANSI. */
function getMessagePart(raw: string): string {
    const withoutPrefix = raw.replace(/^\[[\d:.]+\]\s*\[\w+\]\s?/, '').trim();
    return stripAnsi(withoutPrefix);
}

/** Patterns that indicate start of a new run. Only launch and hot restart/reload; mid-startup lines (Built, VM connect) do not start a run. */
const RUN_START_PATTERNS: { re: RegExp; label: string; kind: RunBoundaryKind }[] = [
    { re: /^Launching\s.+\s+in\s+(?:debug|profile|release)\s+mode/i, label: 'Launch', kind: 'launch' },
    { re: /Performing\s+hot\s+restart|^Hot\s+restart/i, label: 'Hot restart', kind: 'hot_restart' },
    { re: /Performing\s+hot\s+reload|^Hot\s+reload/i, label: 'Hot reload', kind: 'hot_reload' },
];

/** Patterns that indicate end of a run. */
const RUN_END_PATTERNS: { re: RegExp; label: string }[] = [
    { re: /^Application\s+finished\./i, label: 'Application finished' },
    { re: /^Exited\s*\(\s*-?\d+\s*\)/i, label: 'Exited' },
];

function matchRunStart(msg: string, lineIndex: number): RunBoundary | null {
    for (const { re, label, kind } of RUN_START_PATTERNS) {
        if (re.test(msg)) { return { lineIndex, label, kind }; }
    }
    return null;
}

function matchRunEnd(msg: string, lineIndex: number): RunBoundary | null {
    for (const { re, label } of RUN_END_PATTERNS) {
        if (re.test(msg)) { return { lineIndex, label, kind: 'exited' }; }
    }
    return null;
}

/**
 * Scan body lines and return run boundaries (0-based line indices).
 * Body lines are the log content after the context header.
 */
export function detectRunBoundaries(bodyLines: readonly string[]): RunBoundary[] {
    const result: RunBoundary[] = [];
    for (let i = 0; i < bodyLines.length; i++) {
        const msg = getMessagePart(bodyLines[i]);
        if (!msg) { continue; }
        const start = matchRunStart(msg, i);
        if (start) { result.push(start); continue; }
        const end = matchRunEnd(msg, i);
        if (end) { result.push(end); }
    }
    return result;
}

/** Line indices where a new run starts (for Prev/Next run navigation). */
export function getRunStartIndices(boundaries: readonly RunBoundary[]): number[] {
    return boundaries
        .filter((b) => b.kind !== 'exited')
        .map((b) => b.lineIndex);
}
