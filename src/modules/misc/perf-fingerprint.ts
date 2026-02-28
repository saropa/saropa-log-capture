/**
 * Performance fingerprinting: extract named perf traces, Choreographer jank,
 * GC events, and timeouts from a log file and produce stable fingerprints
 * keyed by operation name for cross-session trend tracking.
 */

import * as vscode from 'vscode';
import { stripAnsi } from '../capture/ansi';

const maxScanLines = 5000;
const maxFingerprints = 30;
const maxStackLength = 300;

/** Compact performance fingerprint stored in sidecar metadata. */
export interface PerfFingerprintEntry {
    /** Operation name (e.g., "_getEventCountForDate", "Choreographer", "GC"). */
    readonly name: string;
    /** Average duration in ms across occurrences in this session. */
    readonly avgMs: number;
    /** Minimum duration in ms. */
    readonly minMs: number;
    /** Maximum duration in ms. */
    readonly maxMs: number;
    /** Number of occurrences in this session. */
    readonly count: number;
    /** Stack trace from first occurrence (truncated). */
    readonly stack?: string;
}

// Named PERF traces: [log] PERF _operationName: 1872ms (...)
const perfTraceRe = /\bPERF\s+([\w.]+):\s*(\d+)\s*ms/i;
// Choreographer: Skipped N frames!
const choreographerRe = /Skipped\s+(\d[\d,]*)\s+frames/i;
// GC freed: GC freed NKB ... total Nms
const gcFreedRe = /GC\s+freed\s+([\d,]+)\s*KB/i;
const gcTotalMsRe = /total\s+([\d.]+)\s*ms/i;
// Performance timeout: timed out after Ns
const timeoutRe = /timed\s+out\s+after\s+(\d+)\s*s/i;
// Stack frame line (for collecting stack traces after PERF lines)
const stackFrameRe = /^\s+[\u2800\u00a0 ]*[»›]\s+/;

/** Scan a log file and return performance fingerprints grouped by operation name. */
export async function scanForPerfFingerprints(fileUri: vscode.Uri): Promise<PerfFingerprintEntry[]> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    const groups = new Map<string, PerfAccum>();
    for (let i = 0; i < scanLimit; i++) {
        const consumed = collectPerfEvent(lines, i, scanLimit, groups);
        if (consumed > 0) { i += consumed; }
    }
    return rankPerfFingerprints(groups);
}

type PerfAccum = { durations: number[]; stack?: string };

function addDuration(groups: Map<string, PerfAccum>, name: string, ms: number, stack?: string): void {
    const existing = groups.get(name);
    if (existing) {
        existing.durations.push(ms);
    } else {
        groups.set(name, { durations: [ms], stack });
    }
}

/** Parse a perf event from the line. Returns number of extra lines consumed (stack frames). */
function collectPerfEvent(lines: string[], idx: number, limit: number, groups: Map<string, PerfAccum>): number {
    const plain = stripAnsi(lines[idx].trim());
    if (!plain) { return 0; }

    const perfMatch = perfTraceRe.exec(plain);
    if (perfMatch) {
        const stack = collectStack(lines, idx + 1, limit);
        addDuration(groups, perfMatch[1], parseInt(perfMatch[2], 10), stack.text);
        return stack.count;
    }

    const choreoMatch = choreographerRe.exec(plain);
    if (choreoMatch) {
        const frames = parseInt(choreoMatch[1].replace(/,/g, ''), 10);
        const stack = collectStack(lines, idx + 1, limit);
        addDuration(groups, 'Choreographer', frames, stack.text);
        return stack.count;
    }

    const gcMatch = gcFreedRe.exec(plain);
    if (gcMatch) {
        const totalMatch = gcTotalMsRe.exec(plain);
        const ms = totalMatch ? parseFloat(totalMatch[1]) : 0;
        addDuration(groups, 'GC', ms);
        return 0;
    }

    const timeoutMatch = timeoutRe.exec(plain);
    if (timeoutMatch) {
        addDuration(groups, 'Performance Timeout', parseInt(timeoutMatch[1], 10) * 1000);
        return 0;
    }

    return 0;
}

/** Collect consecutive stack frame lines following a perf event. */
function collectStack(lines: string[], start: number, limit: number): { text: string; count: number } {
    let count = 0;
    const frames: string[] = [];
    for (let i = start; i < limit; i++) {
        if (stackFrameRe.test(lines[i])) {
            frames.push(lines[i].trim());
            count++;
        } else { break; }
    }
    return { text: frames.join('\n').slice(0, maxStackLength), count };
}

function rankPerfFingerprints(groups: Map<string, PerfAccum>): PerfFingerprintEntry[] {
    return [...groups.entries()]
        .map(([name, { durations, stack }]) => {
            const sorted = durations.sort((a, b) => a - b);
            const sum = sorted.reduce((a, b) => a + b, 0);
            return {
                name,
                avgMs: Math.round(sum / sorted.length),
                minMs: sorted[0],
                maxMs: sorted[sorted.length - 1],
                count: sorted.length,
                stack: stack || undefined,
            };
        })
        .sort((a, b) => (b.count * b.avgMs) - (a.count * a.avgMs))
        .slice(0, maxFingerprints);
}
