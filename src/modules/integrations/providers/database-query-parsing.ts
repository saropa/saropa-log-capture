/**
 * Pure parsing for the database query-logs integration (no vscode/fs imports so
 * it stays unit-testable). Two parsers:
 *  - parseQueryBlocks: scan captured session output for inline SQL blocks (parse mode).
 *  - parseTextQueryLog: parse a plain-text DB server log — MySQL slow log,
 *    PostgreSQL log_min_duration_statement, or app-emitted SQL lines (file mode, text format).
 */

import { boundForUserRegex } from '../../misc/regex-safety';

/** Shape of a single query entry written to the sidecar. */
export interface QueryEntry {
    lineStart: number;
    lineEnd: number;
    queryText: string;
    requestId?: string;
    durationMs?: number;
    timestamp?: number;
}

/** Built-in regex for detecting SQL statement starts (statement at line start). */
const builtinSqlPattern = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|MERGE|TRUNCATE|EXPLAIN|WITH)\b/i;

/** Duration pattern: common ORM/log formats like "123ms", "1.5s", "Duration: 42ms". */
const durationPattern = /(?:duration|elapsed|took|time)[=:\s]*(\d+(?:\.\d+)?)\s*(ms|s)\b/i;

/** PostgreSQL log_min_duration_statement: "... statement: SQL" / "... execute <name>: SQL". */
const pgStatementPattern = /\b(?:statement|execute\s+\S+):\s+(.+)$/i;

/** PostgreSQL duration prefix on the same line: "duration: 1.234 ms". */
const pgDurationPattern = /\bduration:\s*([\d.]+)\s*ms\b/i;

/** MySQL slow query log header: "# Query_time: 0.123456" (value is in seconds). */
const mysqlQueryTimePattern = /#\s*Query_time:\s*([\d.]+)/i;

/** Leading ISO-ish timestamp shared by Postgres logs and MySQL "# Time:" lines. */
const isoTimestampPattern = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)/;

/** Extract duration in ms from a line of text. */
export function extractDuration(text: string): number | undefined {
    const m = durationPattern.exec(text);
    if (!m) { return undefined; }
    const val = parseFloat(m[1]);
    return m[2] === 's' ? val * 1000 : val;
}

/** Parse a leading ISO-8601-ish timestamp into epoch ms, or undefined. */
function parseLineTimestamp(line: string): number | undefined {
    const m = isoTimestampPattern.exec(line);
    if (!m) { return undefined; }
    // Postgres uses a space separator ("2026-06-14 10:00:00"); normalize to ISO 'T' for Date.parse.
    const parsed = Date.parse(m[1].replace(' ', 'T'));
    return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Scan nearby lines (up to 5 above the query start) for a request ID.
 * Returns the first match or undefined.
 */
export function findRequestId(
    lines: readonly string[],
    queryLineStart: number,
    requestIdRe: RegExp,
): string | undefined {
    const searchStart = Math.max(0, queryLineStart - 5);
    for (let i = queryLineStart; i >= searchStart; i--) {
        const m = requestIdRe.exec(boundForUserRegex(lines[i]));
        if (m) { return m[1] ?? m[0]; }
    }
    return undefined;
}

/**
 * Parse mode: scan captured session log lines for inline query blocks.
 * Uses queryBlockPattern (user regex) or built-in SQL detection.
 */
export function parseQueryBlocks(
    lines: readonly string[],
    queryBlockPattern: string,
    requestIdPattern: string,
    maxQueries: number,
): QueryEntry[] {
    const blockRe = queryBlockPattern
        ? new RegExp(queryBlockPattern, 'i')
        : builtinSqlPattern;
    const requestIdRe = requestIdPattern
        ? new RegExp(requestIdPattern, 'i')
        : undefined;

    const queries: QueryEntry[] = [];
    let i = 0;
    while (i < lines.length && queries.length < maxQueries) {
        if (!blockRe.test(boundForUserRegex(lines[i]))) { i++; continue; }

        const lineStart = i;
        const parts = [lines[i]];
        i++;
        // Continuation: lines starting with whitespace or common SQL
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !blockRe.test(boundForUserRegex(lines[i]))) {
            parts.push(lines[i]);
            i++;
        }
        const lineEnd = i - 1;
        const queryText = parts.join('\n').trim();
        if (!queryText) { continue; }

        const entry: QueryEntry = { lineStart, lineEnd, queryText };
        entry.durationMs = extractDuration(lines[lineEnd]) ?? extractDuration(lines[Math.min(lineEnd + 1, lines.length - 1)]);
        if (requestIdRe) {
            entry.requestId = findRequestId(lines, lineStart, requestIdRe);
        }
        queries.push(entry);
    }
    return queries;
}

/** Build a single-line text-mode entry, attaching duration/timestamp when present. */
function buildTextEntry(index: number, rawQuery: string, durationMs: number | undefined, sourceLine: string): QueryEntry {
    const entry: QueryEntry = { lineStart: index, lineEnd: index, queryText: rawQuery.trim() };
    if (durationMs !== undefined) { entry.durationMs = durationMs; }
    const ts = parseLineTimestamp(sourceLine);
    if (ts !== undefined) { entry.timestamp = ts; }
    return entry;
}

/**
 * Extract one query from a single text-log line, or undefined if the line holds no SQL.
 * pendingDurationMs carries a MySQL "# Query_time:" header onto the following SQL line.
 */
function extractTextEntry(line: string, index: number, pendingDurationMs: number | undefined): QueryEntry | undefined {
    // Postgres: SQL sits after "statement:"/"execute:", not at line start — check this first.
    const stmt = pgStatementPattern.exec(line);
    if (stmt && builtinSqlPattern.test(stmt[1])) {
        const dur = pgDurationPattern.exec(line);
        return buildTextEntry(index, stmt[1], dur ? parseFloat(dur[1]) : pendingDurationMs, line);
    }
    // Bare SQL at line start: MySQL slow-log statement body, app-emitted SQL.
    if (builtinSqlPattern.test(line)) {
        return buildTextEntry(index, line, pendingDurationMs ?? extractDuration(line), line);
    }
    return undefined;
}

/**
 * File mode, text format: parse a plain-text DB query log line by line.
 * Each detected statement becomes one entry; MySQL "# Query_time:" is attached
 * to the next statement as its duration.
 */
export function parseTextQueryLog(
    lines: readonly string[],
    requestIdPattern: string,
    maxQueries: number,
): QueryEntry[] {
    const requestIdRe = requestIdPattern ? new RegExp(requestIdPattern, 'i') : undefined;
    const out: QueryEntry[] = [];
    let pendingDurationMs: number | undefined;

    for (let i = 0; i < lines.length && out.length < maxQueries; i++) {
        // MySQL slow log: the Query_time header (seconds) applies to the following SQL line.
        const qt = mysqlQueryTimePattern.exec(lines[i]);
        if (qt) { pendingDurationMs = parseFloat(qt[1]) * 1000; continue; }

        const entry = extractTextEntry(lines[i], i, pendingDurationMs);
        if (!entry) { continue; }
        pendingDurationMs = undefined;
        if (requestIdRe) {
            const id = findRequestId(lines, i, requestIdRe);
            if (id) { entry.requestId = id; }
        }
        out.push(entry);
    }
    return out;
}

/**
 * Detect whether an external query log is JSON-lines or plain text, from the
 * first non-empty line. A line opening with '{' or '[' is treated as JSON.
 */
export function detectQueryLogFormat(lines: readonly string[]): 'json' | 'text' {
    const firstNonEmpty = lines.find((l) => l.trim().length > 0);
    if (!firstNonEmpty) { return 'json'; }
    const trimmed = firstNonEmpty.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'text';
}

/** Single-quoted string literal, tolerating doubled-quote ('') escapes inside. */
const sqlStringLiteral = /'(?:[^']|'')*'/g;
/** A numeric literal not embedded in an identifier (avoids matching e.g. the "1" in "table1" or "int4"). */
const sqlNumberLiteral = /(?<![\w.$])\d+(?:\.\d+)?(?![\w.$])/g;

/**
 * Replace string and numeric literals in a SQL statement with `?` so the
 * structured query record can be written to a shared sidecar / bug report
 * without leaking PII or secrets embedded in literal values. Only single-quoted
 * strings are redacted — double quotes are identifiers in standard SQL/Postgres,
 * so touching them would corrupt column/table names. The statement shape (which
 * tables/columns are queried) is preserved deliberately; only the values go.
 */
export function redactSqlLiterals(sql: string): string {
    return sql.replace(sqlStringLiteral, '?').replace(sqlNumberLiteral, '?');
}

/** Keys on a query record that may hold raw SQL; redacted in place when redaction is on. */
const sqlBearingKeys = ['queryText', 'query', 'sql', 'statement'];

/**
 * Return a copy of a query record (QueryEntry or a raw JSON log object) with any
 * SQL-bearing string field redacted. Non-object inputs pass through unchanged.
 */
export function redactQueryRecord(record: unknown): unknown {
    if (!record || typeof record !== 'object') { return record; }
    const copy = { ...(record as Record<string, unknown>) };
    for (const key of sqlBearingKeys) {
        if (typeof copy[key] === 'string') {
            copy[key] = redactSqlLiterals(copy[key] as string);
        }
    }
    return copy;
}
