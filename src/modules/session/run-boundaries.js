"use strict";
/**
 * Detects sub-session boundaries within a log (launch, hot restart/reload, exit).
 * Used for "Prev run / Next run" navigation in the viewer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectRunBoundaries = detectRunBoundaries;
exports.getRunStartIndices = getRunStartIndices;
const ansi_1 = require("../capture/ansi");
/** Strip optional [timestamp] [category] prefix from a log line, then strip ANSI. */
function getMessagePart(raw) {
    const withoutPrefix = raw.replace(/^\[[\d:.]+\]\s*\[\w+\]\s?/, '').trim();
    return (0, ansi_1.stripAnsi)(withoutPrefix);
}
/** Patterns that indicate start of a new run. Only launch and hot restart/reload; mid-startup lines (Built, VM connect) do not start a run. */
const RUN_START_PATTERNS = [
    { re: /^Launching\s.+\s+in\s+(?:debug|profile|release)\s+mode/i, label: 'Launch', kind: 'launch' },
    { re: /Performing\s+hot\s+restart|^Hot\s+restart/i, label: 'Hot restart', kind: 'hot_restart' },
    { re: /Performing\s+hot\s+reload|^Hot\s+reload/i, label: 'Hot reload', kind: 'hot_reload' },
];
/** Patterns that indicate end of a run. */
const RUN_END_PATTERNS = [
    { re: /^Application\s+finished\./i, label: 'Application finished' },
    { re: /^Exited\s*\(\s*-?\d+\s*\)/i, label: 'Exited' },
];
function matchRunStart(msg, lineIndex) {
    for (const { re, label, kind } of RUN_START_PATTERNS) {
        if (re.test(msg)) {
            return { lineIndex, label, kind };
        }
    }
    return null;
}
function matchRunEnd(msg, lineIndex) {
    for (const { re, label } of RUN_END_PATTERNS) {
        if (re.test(msg)) {
            return { lineIndex, label, kind: 'exited' };
        }
    }
    return null;
}
/**
 * Scan body lines and return run boundaries (0-based line indices).
 * Body lines are the log content after the context header.
 */
function detectRunBoundaries(bodyLines) {
    const result = [];
    for (let i = 0; i < bodyLines.length; i++) {
        const msg = getMessagePart(bodyLines[i]);
        if (!msg) {
            continue;
        }
        const start = matchRunStart(msg, i);
        if (start) {
            result.push(start);
            continue;
        }
        const end = matchRunEnd(msg, i);
        if (end) {
            result.push(end);
        }
    }
    return result;
}
/** Line indices where a new run starts (for Prev/Next run navigation). */
function getRunStartIndices(boundaries) {
    return boundaries
        .filter((b) => b.kind !== 'exited')
        .map((b) => b.lineIndex);
}
//# sourceMappingURL=run-boundaries.js.map