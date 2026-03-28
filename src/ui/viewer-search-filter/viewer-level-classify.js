"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLevelClassifyScript = getLevelClassifyScript;
/** Level classification patterns and the classifyLevel() webview function. */
function getLevelClassifyScript() {
    return /* javascript */ `
var looseErrorPattern = /\\b(?:error|exception)(?!\\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\\b|\\b(?:fail(?:ed|ure)?|fatal|panic|critical)\\b|_\\w*(?:Error|Exception)\\b|Null check operator/i;
var strictErrorPattern = /\\w*(?:error|exception)\\s*[:\\]!]|\\[(?:error|exception|fatal|panic|critical)\\]|\\b(?:fatal|panic|critical)\\b|\\bfail(?:ed|ure)\\b|_\\w*(?:Error|Exception)\\b|Null check operator/i;
var driftStatementPattern = /\\bDrift:\\s+Sent\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
var strictLevelDetection = true;
/* When false (default pushed from settings), stderr lines use text-based levels like stdout. */
var stderrTreatAsError = false;
var warnPattern = /\\b(warn(ing)?|caution)\\b/i;
var perfPattern = /\\b(perf(?:ormance)?|dropped\\s+frame|fps|framerate|jank|stutter|skipped\\s+\\d+\\s+frames?|choreographer|doing\\s+too\\s+much\\s+work|gc\\s+(?:pause|freed|concurrent)|anr|application\\s+not\\s+responding)\\b/i;
// Flutter/Dart memory: same context + phrase rules as level-classifier.ts (keep in sync).
var flutterDartContextRe = /(?:^[VDIW]\\/(?:flutter|dart)\\s|package\\/(?:flutter|dart)\\b)/i;
var memoryPhraseRe = /\\b(Memory\\s*:\\s*\\d+|memory\\s+(?:pressure|usage|leak)|(?:old|new)\\s+gen\\s|retained\\s+\\d+|leak\\s+detected|potential\\s+leak)\\b/i;
var todoPattern = /\\b(TODO|FIXME|HACK|XXX)\\b/i;
var debugPattern = /\\b(breadcrumb|trace|debug)\\b/i;
var noticePattern = /\\b(notice|note|important)\\b/i;

/** Logcat prefix (E/, W/, I/, D/, V/, F/, A/) is an authoritative level signal. */
var logcatLevelPattern = /^([VDIWEFA])\\//;
/** Same as level-classifier.ts — capture prefixes may appear before I/flutter. */
var logcatLetterAnywhere = /\\b([VDIWEFA])\\//;

function classifyDriftSqlLine(plainText) {
    var lcm = logcatLevelPattern.exec(plainText);
    var m = lcm || logcatLetterAnywhere.exec(plainText);
    if (!m) return 'info';
    var L = m[1];
    if (L === 'D' || L === 'V') return 'debug';
    if (L === 'W') return 'warning';
    if (L === 'E' || L === 'F' || L === 'A') return 'warning';
    return 'info';
}

/** Used by viewer-data-add to skip severity proximity inheritance for Drift SQL bursts. */
function isDriftSqlStatementLine(plainText) {
    return driftStatementPattern.test(plainText);
}

function classifyLevel(plainText, category) {
    if (stderrTreatAsError && category === 'stderr') return 'error';
    if (driftStatementPattern.test(plainText)) return classifyDriftSqlLine(plainText);
    var ep = strictLevelDetection ? strictErrorPattern : looseErrorPattern;
    var lcm = logcatLevelPattern.exec(plainText);
    if (lcm) {
        var L = lcm[1];
        if (L === 'E' || L === 'F' || L === 'A') return 'error';
        if (L === 'W') return 'warning';
        if (ep.test(plainText)) return 'error';
        if (perfPattern.test(plainText)) return 'performance';
        if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) return 'performance';
        if (todoPattern.test(plainText)) return 'todo';
        if (L === 'V' || L === 'D') return 'debug';
        if (debugPattern.test(plainText)) return 'debug';
        if (noticePattern.test(plainText)) return 'notice';
        return 'info';
    }
    if (ep.test(plainText)) return 'error';
    if (warnPattern.test(plainText)) return 'warning';
    if (perfPattern.test(plainText)) return 'performance';
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) return 'performance';
    if (todoPattern.test(plainText)) return 'todo';
    if (debugPattern.test(plainText)) return 'debug';
    if (noticePattern.test(plainText)) return 'notice';
    return 'info';
}`;
}
//# sourceMappingURL=viewer-level-classify.js.map