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

import * as vscode from 'vscode';
import { stripAnsi } from '../capture/ansi';
import { getConfig } from '../config/config';
import {
    compareScannedSaropaDbFingerprints,
    scanSaropaLogDatabaseFingerprints,
} from '../db/db-session-fingerprint-diff';
import type { SessionDbFingerprintCompareResult } from '../db/db-session-fingerprint-diff';
import type { DbDetectorResult, DbFingerprintSummaryEntry } from '../db/db-detector-types';
import {
    createDbDetectorSessionState,
    runDefaultSessionDbCompareDetectors,
} from '../db/db-detector-framework';

export type { SessionDbFingerprintCompareResult } from '../db/db-session-fingerprint-diff';

/** A line from a log session with its original index. */
export interface LogLine {
    readonly index: number;
    readonly text: string;
    readonly timestamp?: Date;
}

/** Result of comparing a single line. */
export interface DiffLine {
    readonly line: LogLine;
    readonly status: 'unique' | 'common';
}

/** Full diff result for a session pair. */
export interface DiffResult {
    readonly sessionA: {
        readonly uri: vscode.Uri;
        readonly lines: readonly DiffLine[];
        readonly uniqueCount: number;
    };
    readonly sessionB: {
        readonly uri: vscode.Uri;
        readonly lines: readonly DiffLine[];
        readonly uniqueCount: number;
    };
    readonly commonCount: number;
}

async function readLogFileUtf8(uri: vscode.Uri): Promise<string> {
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf-8');
}

function parseLogLinesFromContent(content: string): LogLine[] {
    const rawLines = content.split(/\r?\n/);

    const lines: LogLine[] = [];
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

function diffParsedLogLines(
    linesA: LogLine[],
    linesB: LogLine[],
    uriA: vscode.Uri,
    uriB: vscode.Uri,
): DiffResult {
    const normalizedB = new Set(linesB.map(l => normalizeLine(l.text)));
    const normalizedA = new Set(linesA.map(l => normalizeLine(l.text)));

    const diffA: DiffLine[] = [];
    let uniqueA = 0;
    for (const line of linesA) {
        const normalized = normalizeLine(line.text);
        const status = normalizedB.has(normalized) ? 'common' : 'unique';
        if (status === 'unique') {
            uniqueA++;
        }
        diffA.push({ line, status });
    }

    const diffB: DiffLine[] = [];
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
export async function compareLogSessions(
    uriA: vscode.Uri,
    uriB: vscode.Uri,
): Promise<DiffResult> {
    const [textA, textB] = await Promise.all([
        readLogFileUtf8(uriA),
        readLogFileUtf8(uriB),
    ]);
    return diffParsedLogLines(
        parseLogLinesFromContent(textA),
        parseLogLinesFromContent(textB),
        uriA,
        uriB,
    );
}

export interface CompareLogSessionsWithDbResult {
    readonly diff: DiffResult;
    readonly dbFingerprints: SessionDbFingerprintCompareResult;
    readonly summaryMapA: Map<string, DbFingerprintSummaryEntry>;
    readonly summaryMapB: Map<string, DbFingerprintSummaryEntry>;
    /** Batch `compare()` detector output (baseline volume markers when DB insights are enabled). */
    readonly dbCompareDetectorResults: readonly DbDetectorResult[];
}

/**
 * One read per file: line diff plus Drift SQL fingerprint summary diff (plan DB_10).
 */
export async function compareLogSessionsWithDbFingerprints(
    uriA: vscode.Uri,
    uriB: vscode.Uri,
): Promise<CompareLogSessionsWithDbResult> {
    const [textA, textB] = await Promise.all([
        readLogFileUtf8(uriA),
        readLogFileUtf8(uriB),
    ]);
    const slowMs = getConfig().viewerSlowBurstThresholds.slowQueryMs;
    const scanOpts = typeof slowMs === 'number' && slowMs > 0 ? { slowQueryMs: slowMs } : undefined;
    const scanA = scanSaropaLogDatabaseFingerprints(textA, scanOpts);
    const scanB = scanSaropaLogDatabaseFingerprints(textB, scanOpts);
    const insightsOn = getConfig().viewerDbInsightsEnabled;
    const dbCompareState = createDbDetectorSessionState();
    const dbCompareDetectorResults = insightsOn
        ? runDefaultSessionDbCompareDetectors(
              { baseline: scanA.summary, target: scanB.summary },
              dbCompareState,
          )
        : [];
    return {
        diff: diffParsedLogLines(
            parseLogLinesFromContent(textA),
            parseLogLinesFromContent(textB),
            uriA,
            uriB,
        ),
        dbFingerprints: compareScannedSaropaDbFingerprints(scanA, scanB),
        summaryMapA: scanA.summary,
        summaryMapB: scanB.summary,
        dbCompareDetectorResults,
    };
}

/**
 * Normalize a line for comparison.
 * Strips ANSI codes, timestamps, and extra whitespace.
 */
function normalizeLine(text: string): string {
    let normalized = stripAnsi(text);

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
function extractTimestamp(text: string): Date | undefined {
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
export function findClosestByTimestamp(
    targetTimestamp: Date,
    lines: readonly DiffLine[],
): number {
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
