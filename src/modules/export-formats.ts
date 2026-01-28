/**
 * Export Formats Module
 *
 * Export log sessions to CSV, JSON, and JSONL formats.
 * Parses log lines to extract timestamp, category, level, and message.
 */

import * as vscode from 'vscode';
import { stripAnsi } from './ansi';

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

    const { headerLines, bodyLines, bodyStartIndex } = splitHeader(lines);
    const sessionStart = extractSessionStart(headerLines);

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
        const entry = parseLine(line, bodyStartIndex + i + 1, sessionStart);
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
function parseLine(line: string, lineNumber: number, sessionStart: string | null): LogEntry | null {
    const clean = stripAnsi(line);

    // Try format with timestamp: [HH:MM:SS.mmm] [category] message
    const withTs = clean.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+\[(\w+)\]\s+(.*)$/);
    if (withTs) {
        const timestamp = buildFullTimestamp(withTs[1], sessionStart);
        const category = withTs[2];
        const message = withTs[3];
        return {
            lineNumber,
            timestamp,
            category,
            level: inferLevel(message, category),
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
            level: inferLevel(message, category),
            message,
        };
    }

    // Fallback: treat entire line as message
    return {
        lineNumber,
        timestamp: null,
        category: 'unknown',
        level: inferLevel(clean, 'unknown'),
        message: clean,
    };
}

/**
 * Build a full ISO timestamp from time-only and session start date.
 */
function buildFullTimestamp(timeStr: string, sessionStart: string | null): string {
    if (!sessionStart) {
        return timeStr;
    }
    // Extract date portion from session start (ISO format)
    const dateMatch = sessionStart.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
        // Convert HH:MM:SS.mmm to ISO time format
        return `${dateMatch[1]}T${timeStr}Z`;
    }
    return timeStr;
}

/**
 * Infer log level from message content and category.
 */
function inferLevel(message: string, category: string): string {
    const lower = message.toLowerCase();

    // Check category first
    if (category === 'stderr') {
        return 'error';
    }

    // Check message patterns
    if (/\b(error|exception|fatal|crash|panic)\b/i.test(lower)) {
        return 'error';
    }
    if (/\b(warn(ing)?|caution)\b/i.test(lower)) {
        return 'warning';
    }
    if (/\b(debug|trace|verbose)\b/i.test(lower)) {
        return 'debug';
    }

    return 'info';
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
 * Escape a field for CSV (quote if contains comma, quote, or newline).
 */
function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
