/**
 * Registry of known structured log line formats.
 *
 * Each format defines a regex to detect the format and an extractor function
 * that pulls metadata (timestamp, PID, TID, level, tag) from the line.
 * Formats are tried in priority order; first match wins.
 *
 * Extension-side only — the webview uses a mirrored JS version embedded
 * via `getStructuredLineParserScript()`.
 */

import type { SeverityLevel } from './level-classifier';

/** Metadata extracted from a structured log line prefix. */
export interface ParsedLinePrefix {
    /** Epoch ms — fed into existing timestamp decoration system. */
    readonly timestamp?: number;
    /** Original timestamp string as it appeared in the line. */
    readonly rawTimestamp?: string;
    /** Process ID. */
    readonly pid?: number;
    /** Thread ID (numeric or thread name string). */
    readonly tid?: string;
    /** Raw level indicator as it appeared in the line (e.g. "D", "INFO"). */
    readonly rawLevel?: string;
    /** Normalized severity level hint. */
    readonly level?: SeverityLevel;
    /** Tag / component name (e.g. "Zygote", "ActivityManager"). */
    readonly tag?: string;
    /** Line text with the structured prefix stripped. */
    readonly message: string;
    /** Which format was detected. */
    readonly format: string;
}

/** A single format definition in the registry. */
export interface LineFormat {
    /** Unique identifier for the format (used in ParsedLinePrefix.format). */
    readonly id: string;
    /** Regex that detects whether a line matches this format. */
    readonly pattern: RegExp;
    /** Extract metadata from a regex match. */
    readonly extract: (match: RegExpExecArray, line: string) => ParsedLinePrefix;
}

/** Map single-char logcat levels to SeverityLevel. */
function mapLogcatLevel(ch: string): SeverityLevel {
    if (ch === 'E' || ch === 'F' || ch === 'A') { return 'error'; }
    if (ch === 'W') { return 'warning'; }
    if (ch === 'V' || ch === 'D') { return 'debug'; }
    return 'info';
}

/** Map common textual level strings to SeverityLevel. */
function mapTextLevel(raw: string): SeverityLevel {
    const lc = raw.toLowerCase();
    if (lc === 'error' || lc === 'fatal' || lc === 'critical' || lc === 'emerg' || lc === 'alert') { return 'error'; }
    if (lc === 'warn' || lc === 'warning') { return 'warning'; }
    if (lc === 'debug' || lc === 'trace' || lc === 'verbose') { return 'debug'; }
    if (lc === 'notice') { return 'notice'; }
    return 'info';
}

/**
 * Parse a logcat-style MM-DD HH:MM:SS.mmm timestamp to epoch ms.
 * Uses the current year since logcat doesn't include it.
 */
function parseLogcatTimestamp(ts: string): number {
    const year = new Date().getFullYear();
    const [datePart, timePart] = ts.trim().split(/\s+/);
    const [month, day] = datePart.split('-').map(Number);
    const [h, m, rest] = timePart.split(':');
    const [s, ms] = rest.split('.');
    return new Date(year, month - 1, day, +h, +m, +s, +ms).getTime();
}

/** Parse an ISO-ish timestamp (with T or space separator) to epoch ms. */
function parseIsoTimestamp(ts: string): number {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * All recognized structured log line formats, in priority order.
 * First match wins during per-line parsing.
 */
export const LINE_FORMATS: readonly LineFormat[] = [
    // ── Android threadtime ──────────────────────────────────────────
    // 04-12 20:47:05.621  485  485 D Zygote  : begin preload
    {
        id: 'logcat-threadtime',
        pattern: /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFA])\s+(.+?):\s?(.*)/,
        extract: (m) => ({
            timestamp: parseLogcatTimestamp(m[1]),
            rawTimestamp: m[1],
            pid: parseInt(m[2], 10),
            tid: m[3],
            rawLevel: m[4],
            level: mapLogcatLevel(m[4]),
            tag: m[5].trim(),
            message: m[6],
            format: 'logcat-threadtime',
        }),
    },

    // ── Logcat shorthand ────────────────────────────────────────────
    // D/Zygote  : begin preload
    // E/ActivityManager( 3861): msg
    {
        id: 'logcat-short',
        pattern: /^([VDIWEFA])\/([^(:\s]+)\s*(?:\(\s*\d+\))?:\s?(.*)/,
        extract: (m) => ({
            rawLevel: m[1],
            level: mapLogcatLevel(m[1]),
            tag: m[2].trim(),
            message: m[3],
            format: 'logcat-short',
        }),
    },

    // ── Log4j / Logback ─────────────────────────────────────────────
    // 2026-03-12 14:32:05.123 [main] INFO  com.example.App - Starting
    {
        id: 'log4j',
        pattern: /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d{3})\s+\[([^\]]+)\]\s+(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\s+(\S+)\s+-\s+(.*)/i,
        extract: (m) => ({
            timestamp: parseIsoTimestamp(m[1].replace(',', '.')),
            rawTimestamp: m[1],
            tid: m[2],
            rawLevel: m[3],
            level: mapTextLevel(m[3]),
            tag: m[4],
            message: m[5],
            format: 'log4j',
        }),
    },

    // ── Python logging ──────────────────────────────────────────────
    // 2026-03-12 14:32:05,123 - mymodule - INFO - Starting server
    {
        id: 'python',
        pattern: /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-\s+(\S+)\s+-\s+(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s+-\s+(.*)/i,
        extract: (m) => ({
            timestamp: parseIsoTimestamp(m[1].replace(',', '.')),
            rawTimestamp: m[1],
            tag: m[2],
            rawLevel: m[3],
            level: mapTextLevel(m[3]),
            message: m[4],
            format: 'python',
        }),
    },

    // ── Bracketed timestamp + level ─────────────────────────────────
    // [2026-03-12 14:32:05.123] [INFO] Starting server
    // [2026-03-12T14:32:05.123Z] [ERROR] Something broke
    {
        id: 'bracketed',
        pattern: /^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{3})?Z?)\]\s+\[(TRACE|DEBUG|VERBOSE|INFO|NOTICE|WARN|WARNING|ERROR|FATAL|CRITICAL)\]\s+(.*)/i,
        extract: (m) => ({
            timestamp: parseIsoTimestamp(m[1].replace(',', '.')),
            rawTimestamp: m[1],
            rawLevel: m[2],
            level: mapTextLevel(m[2]),
            message: m[3],
            format: 'bracketed',
        }),
    },

    // ── ISO timestamp + level (no brackets) ─────────────────────────
    // 2026-03-12T14:32:05.123Z INFO Starting server
    // 2026-03-12 14:32:05.123 ERROR Something broke
    {
        id: 'iso-level',
        pattern: /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{3})?Z?)\s+(TRACE|DEBUG|VERBOSE|INFO|NOTICE|WARN|WARNING|ERROR|FATAL|CRITICAL)\s+(.*)/i,
        extract: (m) => ({
            timestamp: parseIsoTimestamp(m[1].replace(',', '.')),
            rawTimestamp: m[1],
            rawLevel: m[2],
            level: mapTextLevel(m[2]),
            message: m[3],
            format: 'iso-level',
        }),
    },

    // ── Syslog (RFC 3164) ───────────────────────────────────────────
    // Mar 12 14:32:05 myhost sshd[1234]: Accepted publickey
    {
        id: 'syslog-3164',
        pattern: /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.*)/,
        extract: (m) => {
            const year = new Date().getFullYear();
            const ts = parseIsoTimestamp(`${m[1]} ${year}`);
            const raw = m[3];
            const pid = m[4] ? parseInt(m[4], 10) : undefined;
            return {
                timestamp: ts || undefined,
                rawTimestamp: m[1],
                pid,
                tag: raw,
                message: m[5],
                format: 'syslog-3164',
            };
        },
    },

    // ── SDA log ─────────────────────────────────────────────────────
    // [log] 14:32:05.123 Something happened
    {
        id: 'sda-log',
        pattern: /^\[(\w+)\]\s+(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+(.*)/,
        extract: (m) => ({
            rawTimestamp: m[2],
            tag: m[1],
            message: m[3],
            format: 'sda-log',
        }),
    },
];

