// cspell:disable

/** Level classification patterns and the classifyLevel() webview function. */
export function getLevelClassifyScript(): string {
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
var todoPattern = /\\b(TODO|FIXME|HACK|XXX|BUG|KLUDGE|WORKAROUND)\\b/i;
var debugPattern = /\\b(breadcrumb|trace|debug)\\b/i;
var noticePattern = /\\b(notice|note|important)\\b/i;
var genericSqlPattern = /\\bSELECT\\b.{1,80}\\bFROM\\b|\\bINSERT\\s+INTO\\b|\\bUPDATE\\b\\s+\\S+\\s+SET\\b|\\bDELETE\\s+FROM\\b|\\bCREATE\\s+(?:TABLE|INDEX|VIEW)\\b|\\bALTER\\s+(?:TABLE|INDEX)\\b|\\bDROP\\s+(?:TABLE|INDEX|VIEW)\\b|\\bPRAGMA\\s+\\w+/i;

/** Logcat prefix (E/, W/, I/, D/, V/, F/, A/) is an authoritative level signal. */
var logcatLevelPattern = /^([VDIWEFA])\\//;
/** Same as level-classifier.ts — capture prefixes may appear before I/flutter. */
var logcatLetterAnywhere = /\\b([VDIWEFA])\\//;
/** Threadtime format: MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: message */
var threadtimeLevelPattern = /^\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+([VDIWEFA])\\s/;

/** Used by viewer-data-add to skip severity proximity inheritance for Drift SQL bursts. */
function isDriftSqlStatementLine(plainText) {
    return driftStatementPattern.test(plainText);
}

function classifyLevel(plainText, category) {
    if (stderrTreatAsError && category === 'stderr') return 'error';
    if (driftStatementPattern.test(plainText)) return 'database';
    var ep = strictLevelDetection ? strictErrorPattern : looseErrorPattern;
    var lcm = logcatLevelPattern.exec(plainText) || threadtimeLevelPattern.exec(plainText);
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
        if (genericSqlPattern.test(plainText)) return 'database';
        return 'info';
    }
    if (ep.test(plainText)) return 'error';
    if (warnPattern.test(plainText)) return 'warning';
    if (perfPattern.test(plainText)) return 'performance';
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) return 'performance';
    if (todoPattern.test(plainText)) return 'todo';
    if (debugPattern.test(plainText)) return 'debug';
    if (noticePattern.test(plainText)) return 'notice';
    if (genericSqlPattern.test(plainText)) return 'database';
    return 'info';
}`;
}
