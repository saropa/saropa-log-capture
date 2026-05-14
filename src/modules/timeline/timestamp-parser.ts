/**
 * Timestamp normalization for heterogeneous log sources.
 * Parses various timestamp formats and returns epoch milliseconds.
 */

/**
 * Parse various timestamp formats to epoch milliseconds.
 * Returns undefined if the format is not recognized.
 *
 * Supported formats:
 * - ISO 8601: "2026-03-12T14:32:05.123Z"
 * - Log prefix: "[2026-03-12 14:32:05.123]"
 * - Elapsed: "[+1234ms]" (relative to sessionStart)
 * - Flutter: "I/flutter (12345): [14:32:05.123]"
 * - Unix epoch ms: "1710251525123" (13 digits)
 * - Unix epoch sec: "1710251525" (10 digits)
 * - Time only: "14:32:05" or "14:32:05.123" (uses session date)
 *
 * @param text The timestamp string to parse.
 * @param sessionStart Optional session start timestamp for relative/time-only formats.
 */
export function parseTimestamp(text: string, sessionStart?: number): number | undefined {
    const trimmed = text.trim().replace(/^\[|\]$/g, '');
    if (!trimmed) { return undefined; }

    // Unix epoch milliseconds (13 digits)
    if (/^\d{13}$/.test(trimmed)) {
        return parseInt(trimmed, 10);
    }

    // Unix epoch seconds (10 digits)
    if (/^\d{10}$/.test(trimmed)) {
        return parseInt(trimmed, 10) * 1000;
    }

    // Elapsed time format: +1234ms or +5s or +1.5s
    const elapsedMatch = trimmed.match(/^\+(\d+(?:\.\d+)?)\s*(ms|s)?$/i);
    if (elapsedMatch && sessionStart !== undefined) {
        const value = parseFloat(elapsedMatch[1]);
        const unit = elapsedMatch[2]?.toLowerCase() ?? 'ms';
        const offsetMs = unit === 's' ? value * 1000 : value;
        return sessionStart + offsetMs;
    }

    // ISO 8601 with timezone
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) { return d.getTime(); }
    }

    // Date + time with space: "2026-03-12 14:32:05.123"
    const dateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/);
    if (dateTimeMatch) {
        const d = new Date(`${dateTimeMatch[1]}T${dateTimeMatch[2]}`);
        if (!isNaN(d.getTime())) { return d.getTime(); }
    }

    // Time only: "14:32:05" or "14:32:05.123"
    const timeOnlyMatch = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
    if (timeOnlyMatch) {
        const [, hh, mm, ss, ms] = timeOnlyMatch;
        const baseDate = sessionStart !== undefined
            ? new Date(sessionStart)
            : new Date();
        baseDate.setHours(parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10));
        if (ms) {
            const millis = parseInt(ms.padEnd(3, '0').slice(0, 3), 10);
            baseDate.setMilliseconds(millis);
        } else {
            baseDate.setMilliseconds(0);
        }
        const result = baseDate.getTime();
        // Handle day rollover: if time is much earlier than session start, it's likely next day
        if (sessionStart !== undefined && result < sessionStart - 12 * 60 * 60 * 1000) {
            return result + 24 * 60 * 60 * 1000;
        }
        return result;
    }

    // Log prefix format: "[2026-03-12 14:32:05.123]" (already stripped brackets)
    const logPrefixMatch = trimmed.match(/^(\d{4}[-/]\d{2}[-/]\d{2})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)$/);
    if (logPrefixMatch) {
        const dateStr = logPrefixMatch[1].replace(/\//g, '-');
        const timeStr = logPrefixMatch[2].replace(',', '.');
        const d = new Date(`${dateStr}T${timeStr}`);
        if (!isNaN(d.getTime())) { return d.getTime(); }
    }

    // Flutter format: "I/flutter (12345): [14:32:05.123]" - extract just the time
    const flutterMatch = trimmed.match(/\[(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/);
    if (flutterMatch) {
        return parseTimestamp(flutterMatch[1], sessionStart);
    }

    // Try native Date parsing as fallback
    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) {
        return fallback.getTime();
    }

    return undefined;
}

/**
 * Extract a leading timestamp from a log line.
 * Returns the parsed timestamp (epoch ms) and the line with the timestamp
 * removed, or undefined if no recognized timestamp prefix is found.
 *
 * Every branch hands the candidate to {@link parseTimestamp} and only commits
 * if it parses — so a bracket/word that merely *looks* like a prefix (e.g.
 * `[stdout]`, `Got 5 12:00:00 …`) is rejected rather than mis-stripped.
 *
 * Recognized prefixes (in priority order):
 * - `[timestamp] rest`        — bracketed (ISO, time-only, epoch, …)
 * - `YYYY-MM-DD{T| }HH:MM:SS[.fff][Z|±HH:MM] rest` — ISO or space-separated date+time
 * - `HH:MM:SS[.fff] rest`     — clock time only (resolved against the session date)
 * - `Mon DD HH:MM:SS rest`    — syslog RFC 3164 (year assumed current)
 * - `<10-13 digit epoch> rest`— Unix epoch seconds / milliseconds
 */
export function extractTimestamp(
    line: string,
    sessionStart?: number,
): { timestamp: number; rest: string } | undefined {
    // Pattern: [timestamp] rest — only wins when the bracket content parses.
    const bracketMatch = line.match(/^\[([^\]]+)\]\s*(.*)/);
    if (bracketMatch) {
        const ts = parseTimestamp(bracketMatch[1], sessionStart);
        if (ts !== undefined) {
            return { timestamp: ts, rest: bracketMatch[2] };
        }
    }

    // Pattern: leading date+time — ISO ("…T…") or space-separated ("YYYY-MM-DD HH:MM:SS"),
    // with optional fractional seconds and a timezone (Z or ±HH:MM) that carries no space.
    const dateTimeMatch = line.match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[^\s]*)\s+(.*)/);
    if (dateTimeMatch) {
        const ts = parseTimestamp(dateTimeMatch[1], sessionStart);
        if (ts !== undefined) {
            return { timestamp: ts, rest: dateTimeMatch[2] };
        }
    }

    // Pattern: leading clock time only — "HH:MM:SS" / "HH:MM:SS.mmm" (comma ms tolerated).
    const timeOnlyMatch = line.match(/^(\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\s+(.*)/);
    if (timeOnlyMatch) {
        const ts = parseTimestamp(timeOnlyMatch[1].replace(',', '.'), sessionStart);
        if (ts !== undefined) {
            return { timestamp: ts, rest: timeOnlyMatch[2] };
        }
    }

    // Pattern: syslog RFC 3164 — "Mon DD HH:MM:SS". Restricted to real month
    // abbreviations: V8's Date parser is lenient enough to "parse" prose like
    // "Got 5 12:00:00", so the regex shape itself must reject non-months.
    const syslogMatch = line.match(
        /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(.*)/,
    );
    if (syslogMatch) {
        const ts = parseTimestamp(syslogMatch[1], sessionStart);
        if (ts !== undefined) {
            return { timestamp: ts, rest: syslogMatch[2] };
        }
    }

    // Pattern: leading Unix epoch — 10-digit (seconds) or 13-digit (milliseconds).
    const epochMatch = line.match(/^(\d{10,13})\s+(.*)/);
    if (epochMatch) {
        const ts = parseTimestamp(epochMatch[1], sessionStart);
        if (ts !== undefined) {
            return { timestamp: ts, rest: epochMatch[2] };
        }
    }

    return undefined;
}

/**
 * Get midnight of the same day as the given timestamp.
 * Used for resolving time-only timestamps to full epoch.
 */
export function getMidnightFromTimestamp(timestamp: number): number {
    const d = new Date(timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * Format an epoch timestamp to a display time string (HH:MM:SS.mmm).
 */
export function formatTimestamp(epoch: number): string {
    if (epoch === 0) { return ''; }
    const d = new Date(epoch);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Format an epoch timestamp to a short display time string (HH:MM:SS).
 */
export function formatTimestampShort(epoch: number): string {
    if (epoch === 0) { return ''; }
    const d = new Date(epoch);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}
