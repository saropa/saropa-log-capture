/**
 * Extension-side severity level classification.
 *
 * Mirrors the regex patterns in viewer-level-filter.ts (webview-side).
 * When updating patterns here, also update viewer-level-filter.ts and vice versa.
 */

/** Valid severity levels. */
export type SeverityLevel = 'info' | 'warning' | 'error' | 'performance' | 'todo' | 'debug' | 'notice';

const logcatLevelPattern = /^([VDIWEFA])\//;
const strictErrorPattern = /\w*(?:error|exception)\s*[:\]!]|\[(?:error|exception|fatal|panic|critical)\]|\b(?:fatal|panic|critical)\b|\bfail(?:ed|ure)\b/i;
const looseErrorPattern = /\b(?:error|exception)(?!\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\b|\b(?:fail(?:ed|ure)?|fatal|panic|critical)\b/i;
const warnPattern = /\b(warn(ing)?|caution)\b/i;
const perfPattern = /\b(performance|dropped\s+frame|fps|framerate|jank|stutter|skipped\s+\d+\s+frames?|choreographer|doing\s+too\s+much\s+work|gc\s+pause|anr|application\s+not\s+responding)\b/i;
const todoPattern = /\b(TODO|FIXME|HACK|XXX)\b/i;
const debugPattern = /\b(breadcrumb|trace|debug)\b/i;
const noticePattern = /\b(notice|note|important)\b/i;

/** Classify a plain-text log line into a severity level. */
export function classifyLevel(plainText: string, category: string, strict: boolean): SeverityLevel {
    if (category === 'stderr') { return 'error'; }
    const lcm = logcatLevelPattern.exec(plainText);
    if (lcm) { return classifyLogcat(lcm[1], plainText); }
    const ep = strict ? strictErrorPattern : looseErrorPattern;
    if (ep.test(plainText)) { return 'error'; }
    return classifyNonError(plainText);
}

/** Whether a level represents an actionable event (shown on timeline). */
export function isActionableLevel(level: SeverityLevel): boolean {
    return level === 'error' || level === 'warning' || level === 'performance' || level === 'todo';
}

function classifyLogcat(prefix: string, plainText: string): SeverityLevel {
    if (prefix === 'E' || prefix === 'F' || prefix === 'A') { return 'error'; }
    if (prefix === 'W') { return 'warning'; }
    if (perfPattern.test(plainText)) { return 'performance'; }
    if (todoPattern.test(plainText)) { return 'todo'; }
    if (prefix === 'V' || prefix === 'D' || debugPattern.test(plainText)) { return 'debug'; }
    if (noticePattern.test(plainText)) { return 'notice'; }
    return 'info';
}

function classifyNonError(plainText: string): SeverityLevel {
    if (warnPattern.test(plainText)) { return 'warning'; }
    if (perfPattern.test(plainText)) { return 'performance'; }
    if (todoPattern.test(plainText)) { return 'todo'; }
    if (debugPattern.test(plainText)) { return 'debug'; }
    if (noticePattern.test(plainText)) { return 'notice'; }
    return 'info';
}
