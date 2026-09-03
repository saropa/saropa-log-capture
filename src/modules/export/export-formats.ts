/**
 * Export formats: CSV, JSON, JSONL. Parses log lines to extract timestamp, category, level, and message.
 * Invoked by export commands (commands-export) and session panel export actions.
 */

import * as vscode from 'vscode';
import { stripAnsi } from '../capture/ansi';
import { classifyLevel } from '../analysis/level-classifier';
import { getConfig } from '../config/config';
import { csvFormulaSafe } from '../misc/outbound-content-safety';

/** A parsed log entry. */
export interface LogEntry {
    readonly lineNumber: number;
    readonly timestamp: string | null;
    readonly category: string;
    readonly level: string;
    readonly message: string;
}

/** Result of parsing a log file. */
interface ParsedLog {
    readonly entries: LogEntry[];
    readonly sessionStart: string | null;
}

/** Options for parsing a single log line. */
interface ParseLineOptions {
    readonly sessionStart: string | null;
    readonly strict: boolean;
    readonly stderrTreatAsError: boolean;
    readonly rollover: RolloverState;
}

/**
 * bug_033 (midnight rollover): mutable state threaded through sequential line parsing
 * within a single export pass. Exported log lines only carry a time-of-day string, not a
 * full date, so a session that runs past local midnight needs a way to notice the
 * calendar day changed. `lastTimeStr` is the previous timestamped line's time-of-day;
 * `dayOffset` counts how many local-midnight rollovers have been detected so far and is
 * added to the session-start date for every subsequent line.
 */
interface RolloverState {
    dayOffset: number;
    lastTimeStr: string | null;
}

/**
 * Export a log file to CSV format.
 */
export async function exportToCsv(logUri: vscode.Uri): Promise<vscode.Uri> {
    const parsed = await parseLogFile(logUri);
    const csvPath = logUri.fsPath.replace(/\.log$/, '.csv');
    const csvUri = vscode.Uri.file(csvPath);

    const lines: string[] = ['timestamp,category,level,line_number,message'];
    for (const entry of parsed.entries) {
        lines.push(formatCsvRow(entry));
    }

    await vscode.workspace.fs.writeFile(csvUri, Buffer.from(lines.join('\n'), 'utf-8'));
    return csvUri;
}

/**
 * Export a log file to JSON format (array of objects).
 */
export async function exportToJson(logUri: vscode.Uri): Promise<vscode.Uri> {
    const parsed = await parseLogFile(logUri);
    const jsonPath = logUri.fsPath.replace(/\.log$/, '.json');
    const jsonUri = vscode.Uri.file(jsonPath);

    const content = JSON.stringify(parsed.entries, null, 2);
    await vscode.workspace.fs.writeFile(jsonUri, Buffer.from(content, 'utf-8'));
    return jsonUri;
}

/**
 * Export a log file to JSONL format (line-delimited JSON).
 */
export async function exportToJsonl(logUri: vscode.Uri): Promise<vscode.Uri> {
    const parsed = await parseLogFile(logUri);
    const jsonlPath = logUri.fsPath.replace(/\.log$/, '.jsonl');
    const jsonlUri = vscode.Uri.file(jsonlPath);

    const lines = parsed.entries.map(entry => JSON.stringify(entry));
    await vscode.workspace.fs.writeFile(jsonlUri, Buffer.from(lines.join('\n'), 'utf-8'));
    return jsonlUri;
}

/**
 * Parse a log file into structured entries.
 */
async function parseLogFile(logUri: vscode.Uri): Promise<ParsedLog> {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const cfg = getConfig();
    const strict = cfg.levelDetection === 'strict';
    const stderrTreatAsError = cfg.stderrTreatAsError;

    const { headerLines, bodyLines, bodyStartIndex } = splitHeader(lines);
    const sessionStart = extractSessionStart(headerLines);
    // bug_033: one rollover tracker shared across the whole file, so a midnight crossing
    // detected on line N still applies to every line after it in this export pass.
    const rollover: RolloverState = { dayOffset: 0, lastTimeStr: null };

    const entries: LogEntry[] = [];
    for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        if (!line.trim()) {
            continue;
        }
        // Skip markers and session end
        if (line.startsWith('---') || line.startsWith('===')) {
            continue;
        }
        const entry = parseLine(line, bodyStartIndex + i + 1, { sessionStart, strict, stderrTreatAsError, rollover });
        if (entry) {
            entries.push(entry);
        }
    }

    return { entries, sessionStart };
}

/**
 * Split header from body at the divider line.
 */
function splitHeader(lines: string[]): {
    headerLines: string[];
    bodyLines: string[];
    bodyStartIndex: number;
} {
    const divider = lines.findIndex(l => l.startsWith('=================='));
    if (divider < 0) {
        return { headerLines: [], bodyLines: lines, bodyStartIndex: 0 };
    }
    return {
        headerLines: lines.slice(0, divider + 1),
        bodyLines: lines.slice(divider + 1),
        bodyStartIndex: divider + 1,
    };
}

/**
 * Extract session start timestamp from header.
 */
function extractSessionStart(headerLines: string[]): string | null {
    for (const line of headerLines) {
        const match = line.match(/^Date:\s+(.+)$/);
        if (match) {
            return match[1].trim();
        }
    }
    return null;
}

/**
 * Parse a single log line into a LogEntry.
 * Format: [HH:MM:SS.mmm] [category] message
 * Or:     [category] message (no timestamp)
 */
function parseLine(
    line: string,
    lineNumber: number,
    opts: ParseLineOptions,
): LogEntry | null {
    const clean = stripAnsi(line);
    const { sessionStart, strict, stderrTreatAsError, rollover } = opts;

    // Try format with timestamp: [HH:MM:SS.mmm] [category] message
    const withTs = clean.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+\[(\w+)\]\s+(.*)$/);
    if (withTs) {
        const timestamp = buildFullTimestamp(withTs[1], sessionStart, rollover);
        const category = withTs[2];
        const message = withTs[3];
        return {
            lineNumber,
            timestamp,
            category,
            level: classifyLevel(message ?? '', category, strict, stderrTreatAsError),
            message,
        };
    }

    // Try format without timestamp: [category] message
    const noTs = clean.match(/^\[(\w+)\]\s+(.*)$/);
    if (noTs) {
        const category = noTs[1];
        const message = noTs[2];
        return {
            lineNumber,
            timestamp: null,
            category,
            level: classifyLevel(message ?? '', category, strict, stderrTreatAsError),
            message,
        };
    }

    // Fallback: treat entire line as message
    return {
        lineNumber,
        timestamp: null,
        category: 'unknown',
        level: classifyLevel(clean, 'unknown', strict, stderrTreatAsError),
        message: clean,
    };
}

/**
 * Build a full timestamp from a per-line time-only string and the session start date.
 *
 * bug_033: `timeStr` is always LOCAL wall-clock time (see `formatTimestamp()` in
 * log-session-helpers.ts, which uses `Date.toTimeString()`), never UTC. The old code
 * regex-extracted the UTC calendar-date substring from the header's `Date:` field
 * (written via `toISOString()`) and glued it directly onto the local `timeStr`, then
 * appended a `Z` suffix — falsely labeling a local time as UTC. Near local midnight,
 * in any timezone offset from UTC, the UTC date substring can also be a different
 * calendar day than the local date the time-of-day actually belongs to, giving lines
 * the wrong date. Fix: parse `sessionStart` into a Date and read its LOCAL calendar
 * date (matching the local `timeStr`), and drop the `Z` suffix since the result is
 * local time, not UTC.
 *
 * bug_033 (rollover): a session that keeps running past local midnight will keep
 * emitting lines whose `timeStr` is still just a time-of-day, with no date component
 * of its own — so without tracking, every line after midnight would still be stamped
 * with the session-start date. Detect the rollover by comparing this line's time-of-day
 * against the previous line's: exported lines are chronological, so a decrease (e.g.
 * "23:59:58" followed by "00:00:02") can only mean the calendar day advanced. `rollover`
 * is threaded through the whole parse pass (one instance per export) so `dayOffset`
 * accumulates across multiple midnight crossings in a single very long session.
 */
function buildFullTimestamp(timeStr: string, sessionStart: string | null, rollover: RolloverState): string {
    if (!sessionStart) {
        return timeStr;
    }
    const parsed = new Date(sessionStart);
    // Guard against an unparseable header value — fall back to the bare time string
    // rather than emitting "NaN-NaN-NaNT..." into the export.
    if (isNaN(parsed.getTime())) {
        return timeStr;
    }
    // A lexical decrease in HH:MM:SS.mmm versus the prior line means local midnight
    // rolled over between them — bump the running day offset. Comparing the previous
    // line rather than the session start lets multi-midnight sessions accumulate offsets.
    if (rollover.lastTimeStr !== null && timeStr < rollover.lastTimeStr) {
        rollover.dayOffset += 1;
    }
    rollover.lastTimeStr = timeStr;

    // Local (not UTC) calendar date, so it lines up with the local time-of-day below.
    // Add the accumulated day offset via setDate() so month/year boundaries (e.g.
    // Jan 31 -> Feb 1) roll over correctly instead of needing manual month-length math.
    const rolled = new Date(parsed);
    rolled.setDate(rolled.getDate() + rollover.dayOffset);
    const year = rolled.getFullYear();
    const month = String(rolled.getMonth() + 1).padStart(2, '0');
    const day = String(rolled.getDate()).padStart(2, '0');
    // No trailing 'Z': timeStr is local wall-clock time, and labeling it UTC was the bug.
    return `${year}-${month}-${day}T${timeStr}`;
}

/**
 * Format a LogEntry as a CSV row.
 */
function formatCsvRow(entry: LogEntry): string {
    const ts = entry.timestamp ?? '';
    const msg = escapeCsvField(entry.message);
    return `${ts},${entry.category},${entry.level},${entry.lineNumber},${msg}`;
}

/**
 * Escape a field for CSV: neutralize spreadsheet formula injection, then quote per RFC 4180
 * (when the value contains a comma, quote, or newline).
 * Exported for use by signals-export-formats and tests.
 */
export function escapeCsvField(value: string): string {
    // Formula-injection guard FIRST so the apostrophe prefix is inside any quoting that follows.
    const safe = csvFormulaSafe(value);
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
        return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
}
