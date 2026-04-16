/**
 * Embedded JS collection for general (non-SQL) signals.
 *
 * Scans `allLines` for recurring warnings, network failures, memory events,
 * slow operations, permission denials, and classified errors.
 * Results are appended to the bundle by `collectRootCauseHintBundleEmbedded`.
 */

import { ROOT_CAUSE_WARNING_MIN_COUNT } from '../../modules/root-cause-hints/root-cause-hint-eligibility';

export function getViewerRootCauseHintsGeneralCollectChunk(slowOpThresholdMs: number): string {
  const MIN_WARN = ROOT_CAUSE_WARNING_MIN_COUNT;
  const MIN_SLOW_MS = slowOpThresholdMs;

  return /* javascript */ `
var rchNetworkPatterns = [
    'SocketException', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
    'ECONNRESET', 'EPIPE', 'Connection refused', 'Network error',
    'Connection reset', 'Connection timed out', 'TimeoutException'
];
var rchMemoryPatterns = [
    'OutOfMemoryError', 'OOM', 'heap exhaustion', 'Cannot allocate',
    'Out of memory', 'memory pressure'
];
var rchPermissionPatterns = [
    'PermissionDenied', 'PERMISSION_DENIED', 'SecurityException',
    'EACCES', 'EPERM', 'Permission denied', 'Access denied'
];
var rchCriticalPatterns = [
    'NullPointerException', 'NullReferenceException', 'AssertionError',
    'FATAL', 'Segmentation fault', 'Stack overflow', 'Panic',
    'Unhandled exception'
];
var rchBugPatterns = [
    'undefined is not a function', 'Cannot read property',
    'is not defined', 'SyntaxError', 'ReferenceError', 'TypeError',
    'Uncaught', 'Unexpected token', 'Invalid argument'
];
var rchDurationRe = /(?:took|elapsed|duration[=:]?|in)\\s*(\\d+(?:\\.\\d+)?)\\s*(ms|s|seconds?|milliseconds?)/i;
/* PERF-line pattern: "PERF operationName: 503ms (extras)" — captures name and duration separately. */
var rchPerfRe = /\\bPERF\\s+([\\w.]+):\\s*(\\d+(?:\\.\\d+)?)\\s*(ms|s)/i;

/** Known HTTP error status codes — explicit map avoids false positives on arbitrary 3-digit numbers. */
var rchHttpErrorCodes = {
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '403': 'Forbidden',
    '404': 'Not Found',
    '405': 'Method Not Allowed',
    '408': 'Request Timeout',
    '409': 'Conflict',
    '413': 'Payload Too Large',
    '422': 'Unprocessable Entity',
    '429': 'Too Many Requests',
    '500': 'Internal Server Error',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    '504': 'Gateway Timeout'
};
var rchHttpCodeRe = new RegExp('\\\\b(' + Object.keys(rchHttpErrorCodes).join('|') + ')\\\\b');

/** HTTP context keywords — the line must contain one of these for a bare status code to count.
 *  Without this guard, PIDs and percentages in logcat (e.g. "502/android.hardware...") false-positive. */
var rchHttpContextRe = /\\b(HTTP|HTTPS|status|response|request|GET|POST|PUT|DELETE|PATCH|HEAD|REST|API|fetch|url|endpoint)\\b/i;

/** Truncate text to a max-200-char excerpt for bundle payloads. */
function rchExcerpt(text) {
    return text.length > 200 ? text.substring(0, 197) + '...' : text;
}

function rchMatchesAny(text, patterns) {
    for (var pi = 0; pi < patterns.length; pi++) {
        if (text.indexOf(patterns[pi]) >= 0) return patterns[pi];
    }
    return null;
}

/**
 * Extract duration (and optional PERF operation name) from a log line.
 * Returns { durationMs, operationName? } or null if no duration found.
 * Tries the more-specific PERF regex first, then the generic duration regex.
 */
function rchExtractDuration(text) {
    var pm = rchPerfRe.exec(text);
    if (pm) {
        var pVal = parseFloat(pm[2]);
        if (pm[3].toLowerCase() === 's') pVal *= 1000;
        return { durationMs: pVal, operationName: pm[1] };
    }
    var m = rchDurationRe.exec(text);
    if (!m) return null;
    var val = parseFloat(m[1]);
    var unit = m[2].toLowerCase();
    if (unit === 's' || unit === 'seconds' || unit === 'second') val *= 1000;
    return { durationMs: val, operationName: undefined };
}

function collectGeneralSignals() {
    var warnings = Object.create(null);
    var networkFailures = [];
    var memoryEvents = [];
    var slowOperations = [];
    var permissionDenials = [];
    var classifiedErrors = [];
    var i, row, plain, wKey, match, durResult;

    if (typeof allLines === 'undefined' || !allLines.length) {
        return { warnings: [], networkFailures: [], memoryEvents: [], slowOperations: [], permissionDenials: [], classifiedErrors: [] };
    }

    for (i = 0; i < allLines.length; i++) {
        row = allLines[i];
        if (!row || row.type !== 'line') continue;
        if (row.isSeparator || row.errorSuppressed) continue;
        plain = stripTags(row.html || '').replace(/\\s+/g, ' ').trim();
        if (plain.length < 4) continue;

        /* Use pre-demotion level for signal analysis: device-other lines demoted from
           warning/error to info still carry originalLevel so recurring patterns surface (plan 050). */
        var signalLevel = row.originalLevel || row.level;
        if (signalLevel === 'warning') {
            wKey = plain.slice(-80).toLowerCase();
            if (!warnings[wKey]) {
                warnings[wKey] = { excerpt: rchExcerpt(plain), count: 0, lineIndices: [] };
            }
            warnings[wKey].count++;
            if (warnings[wKey].lineIndices.length < 8) warnings[wKey].lineIndices.push(i);
        }

        if (signalLevel === 'error' && !row.recentErrorContext) {
            match = rchMatchesAny(plain, rchNetworkPatterns);
            if (match && networkFailures.length < 20) {
                networkFailures.push({ lineIndex: i, excerpt: rchExcerpt(plain), pattern: match });
            }
            match = rchMatchesAny(plain, rchMemoryPatterns);
            if (match && memoryEvents.length < 10) {
                memoryEvents.push({ lineIndex: i, excerpt: rchExcerpt(plain) });
            }
            match = rchMatchesAny(plain, rchPermissionPatterns);
            if (match && permissionDenials.length < 10) {
                permissionDenials.push({ lineIndex: i, excerpt: rchExcerpt(plain) });
            }
            match = rchMatchesAny(plain, rchCriticalPatterns);
            if (match && classifiedErrors.length < 10) {
                classifiedErrors.push({ lineIndex: i, excerpt: rchExcerpt(plain), classification: 'critical' });
            } else {
                match = rchMatchesAny(plain, rchBugPatterns);
                if (match && classifiedErrors.length < 10) {
                    classifiedErrors.push({ lineIndex: i, excerpt: rchExcerpt(plain), classification: 'bug' });
                }
            }
        }

        /* HTTP status code detection — requires an HTTP context keyword on the same line.
           Without the context check, bare numbers like PID 502 in Android logcat
           (e.g. "3% 502/android.hardware.sensors...") false-positive as HTTP 502.
           Database lines are also excluded (numeric values in SQL result sets). */
        var httpMatch = plain.match(rchHttpCodeRe);
        if (httpMatch && row.level !== 'database' && rchHttpContextRe.test(plain) && networkFailures.length < 20) {
            var httpCode = httpMatch[1];
            var httpReason = rchHttpErrorCodes[httpCode] || httpCode;
            networkFailures.push({ lineIndex: i, excerpt: rchExcerpt(plain), pattern: httpCode + ' ' + httpReason });
        }

        durResult = rchExtractDuration(plain);
        if (durResult && durResult.durationMs >= ${MIN_SLOW_MS} && slowOperations.length < 10) {
            slowOperations.push({ lineIndex: i, excerpt: rchExcerpt(plain), durationMs: durResult.durationMs, operationName: durResult.operationName });
        }
    }

    var warnGroups = [];
    var wk;
    for (wk in warnings) {
        if (!Object.prototype.hasOwnProperty.call(warnings, wk)) continue;
        if (warnings[wk].count >= ${MIN_WARN}) {
            warnGroups.push(warnings[wk]);
        }
    }
    warnGroups.sort(function(a, b) { return b.count - a.count; });
    if (warnGroups.length > 5) warnGroups = warnGroups.slice(0, 5);

    return {
        warnings: warnGroups,
        networkFailures: networkFailures,
        memoryEvents: memoryEvents,
        slowOperations: slowOperations,
        permissionDenials: permissionDenials,
        classifiedErrors: classifiedErrors
    };
}
`;
}
