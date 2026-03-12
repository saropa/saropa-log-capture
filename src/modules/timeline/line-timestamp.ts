/**
 * Line timestamp extraction utilities.
 *
 * Extracts timestamps from log line content using various patterns,
 * or infers approximate timestamps from line position within the session.
 */

/** Result of extracting a timestamp from a log line. */
export interface LineTimestampResult {
    /** Epoch milliseconds. */
    timestamp: number;
    /** How confident we are in this timestamp. */
    confidence: 'exact' | 'inferred' | 'session';
    /** Description of how the timestamp was extracted. */
    source: string;
}

/** Common timestamp patterns in log files. */
const TIMESTAMP_PATTERNS: { regex: RegExp; parse: (m: RegExpMatchArray, midnightMs: number) => number | undefined; source: string }[] = [
    {
        regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/,
        parse: (m) => {
            const date = new Date(m[1]);
            return isNaN(date.getTime()) ? undefined : date.getTime();
        },
        source: 'ISO 8601',
    },
    {
        regex: /(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?/,
        parse: (m) => {
            const date = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}${m[5] ? '.' + m[5] : ''}`);
            return isNaN(date.getTime()) ? undefined : date.getTime();
        },
        source: 'datetime',
    },
    {
        regex: /^\[(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?\]/,
        parse: (m, midnightMs) => {
            if (midnightMs === 0) { return undefined; }
            const h = parseInt(m[1], 10);
            const min = parseInt(m[2], 10);
            const s = parseInt(m[3], 10);
            const ms = m[4] ? parseInt(m[4], 10) : 0;
            return midnightMs + (h * 3600000) + (min * 60000) + (s * 1000) + ms;
        },
        source: 'time prefix',
    },
    {
        regex: /\[?(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?\]?/,
        parse: (m, midnightMs) => {
            if (midnightMs === 0) { return undefined; }
            const h = parseInt(m[1], 10);
            const min = parseInt(m[2], 10);
            const s = parseInt(m[3], 10);
            const ms = m[4] ? parseInt(m[4], 10) : 0;
            return midnightMs + (h * 3600000) + (min * 60000) + (s * 1000) + ms;
        },
        source: 'HH:MM:SS',
    },
];

/**
 * Extract timestamp from a log line's text content.
 *
 * Tries multiple common timestamp patterns. If none match, infers an approximate
 * timestamp from the line's position within the session time window.
 *
 * @param lineText - The raw text content of the log line.
 * @param lineIndex - Zero-based index of the line within the log file.
 * @param totalLines - Total number of lines in the log file.
 * @param sessionStart - Epoch ms of session start (from metadata).
 * @param sessionEnd - Epoch ms of session end (from metadata).
 * @param sessionMidnightMs - Epoch ms for midnight of the session date (for time-only parsing).
 * @returns Timestamp result with confidence level.
 */
export function extractLineTimestamp(
    lineText: string,
    lineIndex: number,
    totalLines: number,
    sessionStart: number,
    sessionEnd: number,
    sessionMidnightMs: number = 0,
): LineTimestampResult {
    for (const pattern of TIMESTAMP_PATTERNS) {
        const match = lineText.match(pattern.regex);
        if (match) {
            const ts = pattern.parse(match, sessionMidnightMs);
            if (ts !== undefined && ts > 0) {
                return {
                    timestamp: ts,
                    confidence: 'exact',
                    source: pattern.source,
                };
            }
        }
    }

    if (sessionStart > 0 && sessionEnd > sessionStart && totalLines > 0) {
        const duration = sessionEnd - sessionStart;
        const position = totalLines > 1 ? lineIndex / (totalLines - 1) : 0;
        const inferredTs = sessionStart + Math.round(position * duration);
        return {
            timestamp: inferredTs,
            confidence: 'inferred',
            source: 'line position',
        };
    }

    if (sessionStart > 0) {
        return {
            timestamp: sessionStart,
            confidence: 'session',
            source: 'session start',
        };
    }

    return {
        timestamp: 0,
        confidence: 'session',
        source: 'unknown',
    };
}

/**
 * Extract timestamp from a line that already has a parsed timestamp value.
 *
 * Useful when the webview has already parsed the timestamp during file loading.
 * Falls back to extraction from text if the provided timestamp is zero.
 */
export function extractLineTimestampFromParsed(
    parsedTimestamp: number | undefined,
    lineText: string,
    lineIndex: number,
    totalLines: number,
    sessionStart: number,
    sessionEnd: number,
    sessionMidnightMs: number = 0,
): LineTimestampResult {
    if (parsedTimestamp && parsedTimestamp > 0) {
        return {
            timestamp: parsedTimestamp,
            confidence: 'exact',
            source: 'parsed',
        };
    }
    return extractLineTimestamp(lineText, lineIndex, totalLines, sessionStart, sessionEnd, sessionMidnightMs);
}
