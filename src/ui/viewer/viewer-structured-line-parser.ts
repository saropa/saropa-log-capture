/**
 * Webview-side structured log line parser.
 *
 * Mirrors extension-side `structured-line-formats.ts` / `structured-line-parser.ts`.
 * Detects known log formats, extracts metadata (timestamp, PID, TID, level, tag),
 * and computes the prefix length for display stripping.
 *
 * Called from `addToData()` when `structuredLineParsing` is enabled.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getStructuredLineParserScript(): string {
    return /* javascript */ `
/** Whether structured line parsing is active (user setting, default on). */
var structuredLineParsing = true;
/** Format ID detected by the sniffer (set via extension message), or null for full-chain. */
var sniffedFormatId = null;
/** Whether to show PID/TID in the decoration prefix (default off). */
var showParsedPidTid = false;
/** Whether to show the raw level prefix in the decoration prefix (default off). */
var showParsedLevelPrefix = false;

/* ── Format definitions (priority order) ────────────────────────── */
var structuredFormats = [
    {
        id: 'logcat-threadtime',
        re: /^(\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(\\d+)\\s+(\\d+)\\s+([VDIWEFA])\\s+(.+?):\\s?(.*)/,
        extract: function(m) {
            return { rawTs: m[1], pid: parseInt(m[2],10), tid: m[3], rawLvl: m[4], tag: m[5].trim(), msg: m[6], fmt: 'logcat-threadtime' };
        }
    },
    {
        id: 'logcat-short',
        re: /^([VDIWEFA])\\/([^(:\\s]+)\\s*(?:\\(\\s*\\d+\\))?:\\s?(.*)/,
        extract: function(m) {
            return { rawLvl: m[1], tag: m[2].trim(), msg: m[3], fmt: 'logcat-short' };
        }
    },
    {
        id: 'log4j',
        re: /^(\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}[.,]\\d{3})\\s+\\[([^\\]]+)\\]\\s+(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\\s+(\\S+)\\s+-\\s+(.*)/i,
        extract: function(m) {
            return { rawTs: m[1], tid: m[2], rawLvl: m[3], tag: m[4], msg: m[5], fmt: 'log4j' };
        }
    },
    {
        id: 'python',
        re: /^(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}[.,]\\d{3})\\s+-\\s+(\\S+)\\s+-\\s+(DEBUG|INFO|WARNING|ERROR|CRITICAL)\\s+-\\s+(.*)/i,
        extract: function(m) {
            return { rawTs: m[1], tag: m[2], rawLvl: m[3], msg: m[4], fmt: 'python' };
        }
    },
    {
        id: 'bracketed',
        re: /^\\[(\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:[.,]\\d{3})?Z?)\\]\\s+\\[(TRACE|DEBUG|VERBOSE|INFO|NOTICE|WARN|WARNING|ERROR|FATAL|CRITICAL)\\]\\s+(.*)/i,
        extract: function(m) {
            return { rawTs: m[1], rawLvl: m[2], msg: m[3], fmt: 'bracketed' };
        }
    },
    {
        id: 'iso-level',
        re: /^(\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:[.,]\\d{3})?Z?)\\s+(TRACE|DEBUG|VERBOSE|INFO|NOTICE|WARN|WARNING|ERROR|FATAL|CRITICAL)\\s+(.*)/i,
        extract: function(m) {
            return { rawTs: m[1], rawLvl: m[2], msg: m[3], fmt: 'iso-level' };
        }
    },
    {
        id: 'syslog-3164',
        re: /^([A-Z][a-z]{2}\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2})\\s+(\\S+)\\s+(\\S+?)(?:\\[(\\d+)\\])?:\\s+(.*)/,
        extract: function(m) {
            return { rawTs: m[1], tag: m[3], pid: m[4] ? parseInt(m[4],10) : undefined, msg: m[5], fmt: 'syslog-3164' };
        }
    },
    {
        id: 'sda-log',
        re: /^\\[(\\w+)\\]\\s+(\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?)\\s+(.*)/,
        extract: function(m) {
            return { rawTs: m[2], tag: m[1], msg: m[3], fmt: 'sda-log' };
        }
    }
];

/** Index for O(1) lookup by format ID. */
var structuredFormatIndex = {};
for (var _sfi = 0; _sfi < structuredFormats.length; _sfi++) {
    structuredFormatIndex[structuredFormats[_sfi].id] = structuredFormats[_sfi];
}

/**
 * Try all structured format regexes against a plain-text string.
 * Returns the extracted result or null. Does NOT set prefixLen — caller does that
 * because the caller knows the original text length (which may include skipped brackets).
 */
function tryStructuredFormats(text, formatId) {
    var fmt, m, result;
    if (formatId) {
        fmt = structuredFormatIndex[formatId];
        if (fmt) {
            m = fmt.re.exec(text);
            if (m) { return fmt.extract(m); }
        }
    }
    for (var i = 0; i < structuredFormats.length; i++) {
        fmt = structuredFormats[i];
        m = fmt.re.exec(text);
        if (m) { return fmt.extract(m); }
    }
    return null;
}

/** Regex for a single leading bracket pair like [logcat] or [11:49:55.128]. */
var leadingBracketRe = /^\\[([^\\]]+)\\]\\s?/;

/**
 * Parse a plain-text log line, extracting structured metadata.
 * Returns an object with { rawTs, pid, tid, rawLvl, tag, msg, fmt, prefixLen } or null.
 *
 * DAP adapters (e.g. Flutter) often prepend bracket metadata like
 * [11:49:55.128] [logcat] before the real log format. When a direct match
 * fails, this function strips up to 3 leading bracket pairs and retries,
 * so [ts] [source] 04-13 ... still matches logcat-threadtime.
 */
function parseStructuredPrefix(plain, formatId) {
    if (!plain || !structuredLineParsing) return null;
    /* First attempt: try the original text (covers sda-log, bracketed, etc.
       whose own format starts with a bracket). */
    var result = tryStructuredFormats(plain, formatId);
    if (result) {
        result.prefixLen = plain.length - result.msg.length;
        return result;
    }
    /* No direct match -- progressively strip leading [bracket] pairs and retry.
       prefixLen is always computed against the original plain text so it covers
       the bracket metadata too, and stripHtmlPrefix removes everything. */
    var stripped = plain;
    for (var attempt = 0; attempt < 3; attempt++) {
        var bm = leadingBracketRe.exec(stripped);
        if (!bm) break;
        stripped = stripped.substring(bm[0].length);
        result = tryStructuredFormats(stripped, formatId);
        if (result) {
            /* msg comes from the stripped text; prefixLen spans the full original
               so the renderer strips brackets + structured prefix in one pass. */
            result.prefixLen = plain.length - result.msg.length;
            return result;
        }
    }
    return null;
}

/**
 * Strip N visible characters from the start of an HTML string.
 * Skips over HTML tags and entities (counted as 1 visible char each).
 */
function stripHtmlPrefix(html, prefixLen) {
    var visible = 0, i = 0;
    while (i < html.length && visible < prefixLen) {
        if (html[i] === '<') {
            var close = html.indexOf('>', i);
            if (close >= 0) { i = close + 1; continue; }
        }
        if (html[i] === '&') {
            var semi = html.indexOf(';', i);
            if (semi >= 0 && semi - i < 10) { i = semi + 1; visible++; continue; }
        }
        i++; visible++;
    }
    return html.substring(i);
}

/**
 * Map a raw level indicator to a full human-readable name for tooltips.
 */
function getLevelTooltip(rawLvl, level) {
    if (rawLvl) {
        var ch = rawLvl.charAt(0).toUpperCase();
        if (ch === 'V') return 'Verbose';
        if (ch === 'D') return 'Debug';
        if (ch === 'I') return 'Info';
        if (ch === 'W') return 'Warning';
        if (ch === 'E') return 'Error';
        if (ch === 'F') return 'Fatal';
        if (ch === 'A') return 'Assert';
        var lc = rawLvl.toLowerCase();
        if (lc === 'trace') return 'Trace';
        if (lc === 'debug') return 'Debug';
        if (lc === 'verbose') return 'Verbose';
        if (lc === 'info') return 'Info';
        if (lc === 'notice') return 'Notice';
        if (lc === 'warn' || lc === 'warning') return 'Warning';
        if (lc === 'error') return 'Error';
        if (lc === 'fatal') return 'Fatal';
        if (lc === 'critical') return 'Critical';
    }
    if (level) {
        if (level === 'error') return 'Error';
        if (level === 'warning') return 'Warning';
        if (level === 'performance') return 'Performance';
        if (level === 'debug') return 'Debug';
        if (level === 'notice') return 'Notice';
        if (level === 'database') return 'Database';
        if (level === 'todo') return 'Todo';
        if (level === 'info') return 'Info';
    }
    return null;
}
`;
}
