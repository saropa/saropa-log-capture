"use strict";
/**
 * Diff Engine
 *
 * Compares two log sessions and identifies:
 * - Lines unique to session A
 * - Lines unique to session B
 * - Lines common to both sessions
 *
 * Used for multi-session comparison view with color diff highlighting.
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
exports.compareLogSessions = compareLogSessions;
exports.compareLogSessionsWithDbFingerprints = compareLogSessionsWithDbFingerprints;
exports.findClosestByTimestamp = findClosestByTimestamp;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../capture/ansi");
const config_1 = require("../config/config");
const db_session_fingerprint_diff_1 = require("../db/db-session-fingerprint-diff");
const db_detector_framework_1 = require("../db/db-detector-framework");
async function readLogFileUtf8(uri) {
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf-8');
}
function parseLogLinesFromContent(content) {
    const rawLines = content.split(/\r?\n/);
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
        const text = rawLines[i];
        // Skip empty lines and context header lines
        if (!text.trim() || text.startsWith('─') || text.startsWith('│')) {
            continue;
        }
        lines.push({
            index: i,
            text,
            timestamp: extractTimestamp(text),
        });
    }
    return lines;
}
function diffParsedLogLines(linesA, linesB, uriA, uriB) {
    const normalizedB = new Set(linesB.map(l => normalizeLine(l.text)));
    const normalizedA = new Set(linesA.map(l => normalizeLine(l.text)));
    const diffA = [];
    let uniqueA = 0;
    for (const line of linesA) {
        const normalized = normalizeLine(line.text);
        const status = normalizedB.has(normalized) ? 'common' : 'unique';
        if (status === 'unique') {
            uniqueA++;
        }
        diffA.push({ line, status });
    }
    const diffB = [];
    let uniqueB = 0;
    for (const line of linesB) {
        const normalized = normalizeLine(line.text);
        const status = normalizedA.has(normalized) ? 'common' : 'unique';
        if (status === 'unique') {
            uniqueB++;
        }
        diffB.push({ line, status });
    }
    const commonCount = linesA.length - uniqueA;
    return {
        sessionA: { uri: uriA, lines: diffA, uniqueCount: uniqueA },
        sessionB: { uri: uriB, lines: diffB, uniqueCount: uniqueB },
        commonCount,
    };
}
/**
 * Compare two log sessions and produce a diff result.
 * Uses normalized line text (stripped of ANSI, timestamps) for comparison.
 */
async function compareLogSessions(uriA, uriB) {
    const [textA, textB] = await Promise.all([
        readLogFileUtf8(uriA),
        readLogFileUtf8(uriB),
    ]);
    return diffParsedLogLines(parseLogLinesFromContent(textA), parseLogLinesFromContent(textB), uriA, uriB);
}
/**
 * One read per file: line diff plus Drift SQL fingerprint summary diff (plan DB_10).
 */
async function compareLogSessionsWithDbFingerprints(uriA, uriB) {
    const [textA, textB] = await Promise.all([
        readLogFileUtf8(uriA),
        readLogFileUtf8(uriB),
    ]);
    const slowMs = (0, config_1.getConfig)().viewerSlowBurstThresholds.slowQueryMs;
    const scanOpts = typeof slowMs === 'number' && slowMs > 0 ? { slowQueryMs: slowMs } : undefined;
    const scanA = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(textA, scanOpts);
    const scanB = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(textB, scanOpts);
    const signalsOn = (0, config_1.getConfig)().viewerDbSignalsEnabled;
    const dbCompareState = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const dbCompareDetectorResults = signalsOn
        ? (0, db_detector_framework_1.runDefaultSessionDbCompareDetectors)({ baseline: scanA.summary, target: scanB.summary }, dbCompareState)
        : [];
    return {
        diff: diffParsedLogLines(parseLogLinesFromContent(textA), parseLogLinesFromContent(textB), uriA, uriB),
        dbFingerprints: (0, db_session_fingerprint_diff_1.compareScannedSaropaDbFingerprints)(scanA, scanB),
        summaryMapA: scanA.summary,
        summaryMapB: scanB.summary,
        dbCompareDetectorResults,
    };
}
/**
 * Normalize a line for comparison.
 * Strips ANSI codes, timestamps, and extra whitespace.
 */
function normalizeLine(text) {
    let normalized = (0, ansi_1.stripAnsi)(text);
    // Remove leading timestamp patterns like [HH:MM:SS.mmm] or HH:MM:SS
    normalized = normalized.replace(/^\[?\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]?\s*/, '');
    // Remove leading ISO timestamp
    normalized = normalized.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?\s*/, '');
    // Normalize whitespace
    return normalized.trim().toLowerCase();
}
/**
 * Extract timestamp from a log line if present.
 */
function extractTimestamp(text) {
    // Try ISO format
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
    if (isoMatch) {
        const date = new Date(isoMatch[1]);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    // Try HH:MM:SS format (assume today)
    const timeMatch = text.match(/\[?(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?\]?/);
    if (timeMatch) {
        const now = new Date();
        now.setHours(parseInt(timeMatch[1], 10));
        now.setMinutes(parseInt(timeMatch[2], 10));
        now.setSeconds(parseInt(timeMatch[3], 10));
        if (timeMatch[4]) {
            now.setMilliseconds(parseInt(timeMatch[4], 10));
        }
        return now;
    }
    return undefined;
}
/**
 * Find the closest matching line in session B by timestamp.
 * Used for synchronized scrolling.
 */
function findClosestByTimestamp(targetTimestamp, lines) {
    let closestIndex = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < lines.length; i++) {
        const ts = lines[i].line.timestamp;
        if (ts) {
            const diff = Math.abs(ts.getTime() - targetTimestamp.getTime());
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = i;
            }
        }
    }
    return closestIndex;
}
//# sourceMappingURL=diff-engine.js.map