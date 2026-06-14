/**
 * Pure helpers for live database-query tailing (no vscode/fs imports). Convert
 * newly-appended query-log lines (JSON objects or plain-text DB log lines) into
 * QueryEntry records and format each as a single live log line for the viewer.
 */

import { parseTextQueryLog, type QueryEntry } from './database-query-parsing';

/** Parse a JSON line into an object, or undefined if it is not a JSON object. */
function tryParseJsonObject(line: string): Record<string, unknown> | undefined {
    try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : undefined;
    } catch { return undefined; }
}

/** First string-valued field among the given keys, trimmed; undefined if none. */
function firstString(obj: Record<string, unknown>, keys: readonly string[]): string | undefined {
    for (const key of keys) {
        const v = obj[key];
        if (typeof v === 'string' && v.trim()) { return v.trim(); }
    }
    return undefined;
}

/** Coerce a timestamp field (epoch number or ISO string) to epoch ms, or undefined. */
function coerceTimestamp(value: unknown): number | undefined {
    if (typeof value === 'number') { return value; }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

/** Convert a raw JSON query-log object into a QueryEntry, or undefined if it carries no SQL. */
export function jsonRecordToEntry(obj: Record<string, unknown>): QueryEntry | undefined {
    const queryText = firstString(obj, ['queryText', 'query', 'sql', 'statement']);
    if (!queryText) { return undefined; }
    const entry: QueryEntry = { lineStart: 0, lineEnd: 0, queryText };
    const dur = obj.durationMs ?? obj.duration ?? obj.elapsedMs;
    if (typeof dur === 'number') { entry.durationMs = dur; }
    if (typeof obj.requestId === 'string' && obj.requestId) { entry.requestId = obj.requestId; }
    const ts = coerceTimestamp(obj.timestamp ?? obj.time ?? obj.ts);
    if (ts !== undefined) { entry.timestamp = ts; }
    return entry;
}

/** Format a query as a single live viewer line, e.g. "SQL: [req-7] SELECT ... (12ms)". */
export function formatQueryEntry(entry: QueryEntry): string {
    const req = entry.requestId ? ` [${entry.requestId}]` : '';
    const dur = typeof entry.durationMs === 'number' ? ` (${entry.durationMs}ms)` : '';
    const oneLine = entry.queryText.replace(/\s+/g, ' ').trim();
    return `SQL:${req} ${oneLine}${dur}`;
}

/**
 * Parse a batch of newly-appended log lines into query entries. JSON format
 * parses each line as an object; text format runs the shared text-log parser.
 */
export function parseNewQueryLines(
    lines: readonly string[],
    format: 'json' | 'text',
    requestIdPattern: string,
): QueryEntry[] {
    if (format === 'text') {
        // 10k cap bounds a single burst; live tailing repeats per fs.watch event.
        return parseTextQueryLog(lines, requestIdPattern, 10_000);
    }
    const out: QueryEntry[] = [];
    for (const line of lines) {
        const obj = tryParseJsonObject(line);
        if (!obj) { continue; }
        const entry = jsonRecordToEntry(obj);
        if (entry) { out.push(entry); }
    }
    return out;
}
