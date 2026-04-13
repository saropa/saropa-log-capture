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
 * Parse a plain-text log line, extracting structured metadata.
 * Returns an object with { rawTs, pid, tid, rawLvl, tag, msg, fmt, prefixLen } or null.
 */
function parseStructuredPrefix(plain, formatId) {
    if (!plain || !structuredLineParsing) return null;
    var fmt, m, result;
    // Tier 1/2: try specified format first
    if (formatId) {
        fmt = structuredFormatIndex[formatId];
        if (fmt) {
            m = fmt.re.exec(plain);
            if (m) {
                result = fmt.extract(m);
                result.prefixLen = plain.length - result.msg.length;
                return result;
            }
        }
    }
    // Tier 3: full chain
    for (var i = 0; i < structuredFormats.length; i++) {
        fmt = structuredFormats[i];
        m = fmt.re.exec(plain);
        if (m) {
            result = fmt.extract(m);
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
