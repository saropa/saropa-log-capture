"use strict";
/**
 * Extension-side severity level classification.
 * Mirrors `viewer-level-classify.ts` (embedded webview script). Keep patterns in sync.
 * Used by viewer level filter, analysis panel, and error classification.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDriftSqlStatementLine = isDriftSqlStatementLine;
exports.classifyLevel = classifyLevel;
exports.isAnrLine = isAnrLine;
exports.isActionableLevel = isActionableLevel;
const logcatLevelPattern = /^([VDIWEFA])\//;
/** Threadtime format: `MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: message` (from `adb logcat -v threadtime`). */
const threadtimeLevelPattern = /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+([VDIWEFA])\s/;
// Drift SQL statement logs can contain enum values like "ApplicationLogError" in args.
// Treat them as query/debug output so they don't get misclassified as runtime errors.
const driftStatementPattern = /\bDrift:\s+Sent\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;
const strictErrorPattern = /\w*(?:error|exception)\s*[:\]!]|\[(?:error|exception|fatal|panic|critical)\]|\b(?:fatal|panic|critical)\b|_\w*(?:Error|Exception)\b|Null check operator/i;
const looseErrorPattern = /\b(?:error|exception)(?!\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\b|\b(?:fatal|panic|critical)\b|_\w*(?:Error|Exception)\b|Null check operator/i;
const warnPattern = /\b(warn(ing)?|caution|fail(?:ed|ure)?)\b/i;
const anrPattern = /\b(anr|application\s+not\s+responding|input\s+dispatching\s+timed\s+out)\b/i;
// Performance: PERF/jank/GC/ANR — well-established patterns.
const perfPattern = /\b(perf(?:ormance)?|dropped\s+frame|fps|framerate|jank|stutter|skipped\s+\d+\s+frames?|choreographer|doing\s+too\s+much\s+work|gc\s+(?:pause|freed|concurrent)|anr|application\s+not\s+responding)\b/i;
// Flutter/Dart memory: applied only when line has Flutter/Dart context (logcat tag or package path).
// High-confidence phrases only; no bare "heap"/"memory" to avoid false positives in other runtimes.
const flutterDartContextRe = /(?:^[VDIW]\/(?:flutter|dart)[\s:]|package[\/:](?:flutter|dart)\b)/i;
const memoryPhraseRe = /\b(Memory\s*:\s*\d+|memory\s+(?:pressure|usage|leak)|(?:old|new)\s+gen\s|retained\s+\d+|leak\s+detected|potential\s+leak)\b/i;
const todoPattern = /\b(TODO|FIXME|HACK|XXX|BUG|KLUDGE|WORKAROUND)\b/i;
const debugPattern = /\b(breadcrumb|trace|debug)\b/i;
const noticePattern = /\b(notice|note|important)\b/i;
// Generic SQL: requires structural keyword pairs to avoid false positives on bare words.
// Drift lines are caught earlier by driftStatementPattern; this covers other ORMs and raw SQL.
const genericSqlPattern = /\bSELECT\b.{1,80}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b\s+\S+\s+SET\b|\bDELETE\s+FROM\b|\bCREATE\s+(?:TABLE|INDEX|VIEW)\b|\bALTER\s+(?:TABLE|INDEX)\b|\bDROP\s+(?:TABLE|INDEX|VIEW)\b|\bPRAGMA\s+\w+/i;
/** True when the line is a Drift SQL trace (`Drift: Sent …`). Used by the viewer to skip severity proximity inheritance. */
function isDriftSqlStatementLine(plainText) {
    return driftStatementPattern.test(plainText);
}
/**
 * Classify a plain-text log line into a severity level.
 *
 * @param stderrTreatAsError When `true`, forces `error` for DAP category `stderr` before inspecting text.
 *   Omit or pass `true` to preserve legacy behavior for callers that do not read workspace config.
 *   Workspace default is `false` (classify stderr by content).
 */
function classifyLevel(plainText, category, strict, stderrTreatAsError = true) {
    if (stderrTreatAsError && category === 'stderr') {
        return 'error';
    }
    if (driftStatementPattern.test(plainText)) {
        return 'database';
    }
    const lcm = logcatLevelPattern.exec(plainText) ?? threadtimeLevelPattern.exec(plainText);
    if (lcm) {
        return classifyLogcat(lcm[1], plainText, strict);
    }
    const ep = strict ? strictErrorPattern : looseErrorPattern;
    if (ep.test(plainText)) {
        return 'error';
    }
    return classifyNonError(plainText);
}
/** Whether the text matches an ANR-specific pattern (subset of performance). */
function isAnrLine(plainText) { return anrPattern.test(plainText); }
/** Whether a level represents an actionable event (shown on timeline). */
function isActionableLevel(level) {
    return level === 'error' || level === 'warning' || level === 'performance' || level === 'todo';
}
function classifyLogcat(prefix, plainText, strict) {
    if (prefix === 'E' || prefix === 'F' || prefix === 'A') {
        return 'error';
    }
    if (prefix === 'W') {
        return 'warning';
    }
    const ep = strict ? strictErrorPattern : looseErrorPattern;
    if (ep.test(plainText)) {
        return 'error';
    }
    if (perfPattern.test(plainText)) {
        return 'performance';
    }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) {
        return 'performance';
    }
    if (todoPattern.test(plainText)) {
        return 'todo';
    }
    if (prefix === 'V' || prefix === 'D' || debugPattern.test(plainText)) {
        return 'debug';
    }
    if (noticePattern.test(plainText)) {
        return 'notice';
    }
    if (genericSqlPattern.test(plainText)) {
        return 'database';
    }
    return 'info';
}
function classifyNonError(plainText) {
    // Memory phrases without Flutter/Dart context stay info (e.g. "memory pressure warning")
    if (memoryPhraseRe.test(plainText) && !flutterDartContextRe.test(plainText)) {
        return 'info';
    }
    if (warnPattern.test(plainText)) {
        return 'warning';
    }
    if (perfPattern.test(plainText)) {
        return 'performance';
    }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) {
        return 'performance';
    }
    if (todoPattern.test(plainText)) {
        return 'todo';
    }
    if (debugPattern.test(plainText)) {
        return 'debug';
    }
    if (noticePattern.test(plainText)) {
        return 'notice';
    }
    if (genericSqlPattern.test(plainText)) {
        return 'database';
    }
    return 'info';
}
//# sourceMappingURL=level-classifier.js.map