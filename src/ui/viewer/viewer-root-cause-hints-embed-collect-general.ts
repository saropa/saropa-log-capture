/**
 * Embedded JS collection for general (non-SQL) signals.
 *
 * Scans `allLines` for recurring warnings, network failures, memory events,
 * slow operations, permission denials, and classified errors.
 * Results are appended to the bundle by `collectRootCauseHintBundleEmbedded`.
 */

import { ROOT_CAUSE_SLOW_OP_MIN_MS, ROOT_CAUSE_WARNING_MIN_COUNT } from '../../modules/root-cause-hints/root-cause-hint-eligibility';

export function getViewerRootCauseHintsGeneralCollectChunk(): string {
  const MIN_WARN = ROOT_CAUSE_WARNING_MIN_COUNT;
  const MIN_SLOW_MS = ROOT_CAUSE_SLOW_OP_MIN_MS;

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

function rchMatchesAny(text, patterns) {
    for (var pi = 0; pi < patterns.length; pi++) {
        if (text.indexOf(patterns[pi]) >= 0) return patterns[pi];
    }
    return null;
}

function rchExtractDuration(text) {
    var m = rchDurationRe.exec(text);
    if (!m) return -1;
    var val = parseFloat(m[1]);
    var unit = m[2].toLowerCase();
    if (unit === 's' || unit === 'seconds' || unit === 'second') return val * 1000;
    return val;
}

function collectGeneralSignals() {
    var warnings = Object.create(null);
    var networkFailures = [];
    var memoryEvents = [];
    var slowOperations = [];
    var permissionDenials = [];
    var classifiedErrors = [];
    var i, row, plain, wKey, match, dur;

    if (typeof allLines === 'undefined' || !allLines.length) {
        return { warnings: [], networkFailures: [], memoryEvents: [], slowOperations: [], permissionDenials: [], classifiedErrors: [] };
    }

    for (i = 0; i < allLines.length; i++) {
        row = allLines[i];
        if (!row || row.type !== 'line') continue;
        if (row.isSeparator || row.errorSuppressed) continue;
        plain = stripTags(row.html || '').replace(/\\s+/g, ' ').trim();
        if (plain.length < 4) continue;

        if (row.level === 'warning') {
            wKey = plain.slice(-80).toLowerCase();
            if (!warnings[wKey]) {
                warnings[wKey] = { excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain, count: 0, lineIndices: [] };
            }
            warnings[wKey].count++;
            if (warnings[wKey].lineIndices.length < 8) warnings[wKey].lineIndices.push(i);
        }

        if (row.level === 'error' && !row.recentErrorContext) {
            match = rchMatchesAny(plain, rchNetworkPatterns);
            if (match && networkFailures.length < 20) {
                networkFailures.push({ lineIndex: i, excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain, pattern: match });
            }
            match = rchMatchesAny(plain, rchMemoryPatterns);
            if (match && memoryEvents.length < 10) {
                memoryEvents.push({ lineIndex: i, excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain });
            }
            match = rchMatchesAny(plain, rchPermissionPatterns);
            if (match && permissionDenials.length < 10) {
                permissionDenials.push({ lineIndex: i, excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain });
            }
            match = rchMatchesAny(plain, rchCriticalPatterns);
            if (match && classifiedErrors.length < 10) {
                classifiedErrors.push({ lineIndex: i, excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain, classification: 'critical' });
            } else {
                match = rchMatchesAny(plain, rchBugPatterns);
                if (match && classifiedErrors.length < 10) {
                    classifiedErrors.push({ lineIndex: i, excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain, classification: 'bug' });
                }
            }
        }

        dur = rchExtractDuration(plain);
        if (dur >= ${MIN_SLOW_MS} && slowOperations.length < 10) {
            slowOperations.push({ lineIndex: i, excerpt: plain.length > 200 ? plain.substring(0, 197) + '...' : plain, durationMs: dur });
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
