/**
 * Quick severity counting for session history display.
 *
 * Scans log file body text using simplified patterns from level-classifier.ts
 * to produce error/warning/performance counts for the session list.
 */

const looseErrorRe = /\b(?:error|exception)(?!\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\b|\b(?:fail(?:ed|ure)?|fatal|panic|critical)\b/i;
const logcatErrorRe = /^[EFA]\//;
const warnRe = /\b(?:warn(?:ing)?|caution)\b/i;
const logcatWarnRe = /^W\//;
const perfRe = /\b(?:performance|dropped\s+frame|fps|jank|stutter|skipped\s+\d+\s+frames?|choreographer|doing\s+too\s+much\s+work|gc\s+pause|anr|application\s+not\s+responding)\b/i;
const anrRe = /\b(?:anr|application\s+not\s+responding|input\s+dispatching\s+timed\s+out)\b/i;

/** Severity counts extracted from a log file body. */
export interface SeverityCounts {
    readonly errors: number;
    readonly warnings: number;
    readonly perfs: number;
    readonly anrs: number;
}

/** Count error/warning/performance lines in the body text of a log file. */
export function countSeverities(bodyText: string): SeverityCounts {
    let errors = 0;
    let warnings = 0;
    let perfs = 0;
    let anrs = 0;
    const lines = bodyText.split('\n');
    for (const line of lines) {
        if (line.length === 0 || line.startsWith('---') || line.startsWith('===')) { continue; }
        // Strip timestamp prefix [HH:MM:SS.mmm] [category] to get the message
        const msg = line.replace(/^\[[\d:.]+\]\s*\[\w+\]\s?/, '');
        if (looseErrorRe.test(msg) || logcatErrorRe.test(msg)) { errors++; }
        else if (warnRe.test(msg) || logcatWarnRe.test(msg)) { warnings++; }
        else if (perfRe.test(msg)) { perfs++; if (anrRe.test(msg)) { anrs++; } }
    }
    return { errors, warnings, perfs, anrs };
}

/** Extract the body text from a full log file (everything after the header separator). */
export function extractBody(fullText: string): string {
    const headerEnd = fullText.indexOf('==================');
    if (headerEnd <= 0) { return fullText; }
    const afterSep = fullText.indexOf('\n', headerEnd);
    if (afterSep < 0) { return ''; }
    // Skip the blank line after the separator
    const bodyStart = fullText.indexOf('\n', afterSep + 1);
    return bodyStart >= 0 ? fullText.slice(bodyStart + 1) : '';
}
