/**
 * Extension-side severity level classification.
 * Mirrors the regex patterns in viewer-level-filter.ts (webview-side).
 * Used by viewer level filter, analysis panel, and error classification; keep in sync with viewer-level-filter.ts.
 */

/** Valid severity levels. */
export type SeverityLevel = 'info' | 'warning' | 'error' | 'performance' | 'todo' | 'debug' | 'notice';

const logcatLevelPattern = /^([VDIWEFA])\//;
const strictErrorPattern = /\w*(?:error|exception)\s*[:\]!]|\[(?:error|exception|fatal|panic|critical)\]|\b(?:fatal|panic|critical)\b|\bfail(?:ed|ure)\b|_\w*(?:Error|Exception)\b|Null check operator/i;
const looseErrorPattern = /\b(?:error|exception)(?!\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\b|\b(?:fail(?:ed|ure)?|fatal|panic|critical)\b|_\w*(?:Error|Exception)\b|Null check operator/i;
const warnPattern = /\b(warn(ing)?|caution)\b/i;
const anrPattern = /\b(anr|application\s+not\s+responding|input\s+dispatching\s+timed\s+out)\b/i;
// Performance: PERF/jank/GC/ANR — well-established patterns.
const perfPattern = /\b(perf(?:ormance)?|dropped\s+frame|fps|framerate|jank|stutter|skipped\s+\d+\s+frames?|choreographer|doing\s+too\s+much\s+work|gc\s+(?:pause|freed|concurrent)|anr|application\s+not\s+responding)\b/i;
// Flutter/Dart memory: applied only when line has Flutter/Dart context (logcat tag or package path).
// High-confidence phrases only; no bare "heap"/"memory" to avoid false positives in other runtimes.
const flutterDartContextRe = /(?:^[VDIW]\/(?:flutter|dart)[\s:]|package[\/:](?:flutter|dart)\b)/i;
const memoryPhraseRe = /\b(Memory\s*:\s*\d+|memory\s+(?:pressure|usage|leak)|(?:old|new)\s+gen\s|retained\s+\d+|leak\s+detected|potential\s+leak)\b/i;
const todoPattern = /\b(TODO|FIXME|HACK|XXX)\b/i;
const debugPattern = /\b(breadcrumb|trace|debug)\b/i;
const noticePattern = /\b(notice|note|important)\b/i;

/** Classify a plain-text log line into a severity level. */
export function classifyLevel(plainText: string, category: string, strict: boolean): SeverityLevel {
    if (category === 'stderr') { return 'error'; }
    const lcm = logcatLevelPattern.exec(plainText);
    if (lcm) { return classifyLogcat(lcm[1], plainText, strict); }
    const ep = strict ? strictErrorPattern : looseErrorPattern;
    if (ep.test(plainText)) { return 'error'; }
    return classifyNonError(plainText);
}

/** Whether the text matches an ANR-specific pattern (subset of performance). */
export function isAnrLine(plainText: string): boolean { return anrPattern.test(plainText); }

/** Whether a level represents an actionable event (shown on timeline). */
export function isActionableLevel(level: SeverityLevel): boolean {
    return level === 'error' || level === 'warning' || level === 'performance' || level === 'todo';
}

function classifyLogcat(prefix: string, plainText: string, strict: boolean): SeverityLevel {
    if (prefix === 'E' || prefix === 'F' || prefix === 'A') { return 'error'; }
    if (prefix === 'W') { return 'warning'; }
    const ep = strict ? strictErrorPattern : looseErrorPattern;
    if (ep.test(plainText)) { return 'error'; }
    if (perfPattern.test(plainText)) { return 'performance'; }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) { return 'performance'; }
    if (todoPattern.test(plainText)) { return 'todo'; }
    if (prefix === 'V' || prefix === 'D' || debugPattern.test(plainText)) { return 'debug'; }
    if (noticePattern.test(plainText)) { return 'notice'; }
    return 'info';
}

function classifyNonError(plainText: string): SeverityLevel {
    // Memory phrases without Flutter/Dart context stay info (e.g. "memory pressure warning")
    if (memoryPhraseRe.test(plainText) && !flutterDartContextRe.test(plainText)) { return 'info'; }
    if (warnPattern.test(plainText)) { return 'warning'; }
    if (perfPattern.test(plainText)) { return 'performance'; }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) { return 'performance'; }
    if (todoPattern.test(plainText)) { return 'todo'; }
    if (debugPattern.test(plainText)) { return 'debug'; }
    if (noticePattern.test(plainText)) { return 'notice'; }
    return 'info';
}
