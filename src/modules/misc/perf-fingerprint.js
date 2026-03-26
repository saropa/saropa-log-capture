"use strict";
/**
 * Performance fingerprinting: extract named perf traces, Choreographer jank,
 * GC events, and timeouts from a log file and produce stable fingerprints
 * keyed by operation name for cross-session trend tracking.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanForPerfFingerprints = scanForPerfFingerprints;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../capture/ansi");
const maxScanLines = 5000;
const maxFingerprints = 30;
const maxStackLength = 300;
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
async function scanForPerfFingerprints(fileUri) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    const groups = new Map();
    for (let i = 0; i < scanLimit; i++) {
        const consumed = collectPerfEvent(lines, i, scanLimit, groups);
        if (consumed > 0) {
            i += consumed;
        }
    }
    return rankPerfFingerprints(groups);
}
function addDuration(groups, name, ms, stack) {
    const existing = groups.get(name);
    if (existing) {
        existing.durations.push(ms);
    }
    else {
        groups.set(name, { durations: [ms], stack });
    }
}
/** Parse a perf event from the line. Returns number of extra lines consumed (stack frames). */
function collectPerfEvent(lines, idx, limit, groups) {
    const plain = (0, ansi_1.stripAnsi)(lines[idx].trim());
    if (!plain) {
        return 0;
    }
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
function collectStack(lines, start, limit) {
    let count = 0;
    const frames = [];
    for (let i = start; i < limit; i++) {
        if (stackFrameRe.test(lines[i])) {
            frames.push(lines[i].trim());
            count++;
        }
        else {
            break;
        }
    }
    return { text: frames.join('\n').slice(0, maxStackLength), count };
}
function rankPerfFingerprints(groups) {
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
//# sourceMappingURL=perf-fingerprint.js.map