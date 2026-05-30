/**
 * Severity counting for the session-history list panel.
 *
 * Calls the authoritative `classifyLevel()` from modules/analysis/level-classifier.ts
 * — the SAME classifier the viewer's top-bar E/W/I/D counts use — so the list
 * badges agree with what the user sees when they open the log. Was previously a
 * parallel, simplified regex bank (`countSeverities` V1) that disagreed with the
 * viewer in three documented ways:
 *  - missed Flutter "Exception caught by …" banners (E count too low)
 *  - missed structural "could not / unable to / failed to" warnings (W too low)
 *  - had no debug/database/todo/notice buckets (those lumped into "other" gray dot)
 *
 * Producer never writes `fwCount`: classifyLevel has no framework bucket — what
 * V1 called "framework" (non-flutter logcat I/D tags + launch boilerplate)
 * naturally classifies as info or debug now. V1 sidecars keep their `fwCount`
 * read-only; the V2 cache gate is `debugCount !== undefined`.
 */

import { classifyLevel, isAnrLine } from '../../modules/analysis/level-classifier';

/** Severity counts extracted from a log file body. Mirrors classifyLevel()'s 8 levels. */
export interface SeverityCounts {
    readonly errors: number;
    readonly warnings: number;
    readonly perfs: number;
    /** ANR pattern subset of perfs — surfaced as a separate badge. */
    readonly anrs: number;
    readonly infos: number;
    readonly debugs: number;
    readonly databases: number;
    readonly todos: number;
    readonly notices: number;
}

/** Strip the timestamp + category prefix that LogSession writes (`[hh:mm:ss.ms] [stdout] `).
 *  Without this, classifyLevel sees the bracket prefix instead of the real line head and
 *  misses logcat/threadtime/database-vendor patterns that are anchored to ^. */
const timestampPrefixRe = /^\[[\d:.]+\]\s*\[\w+\]\s?/;

/** Count error/warning/perf/info/debug/database/todo/notice lines in the body text.
 *  Skips blank lines and bare separator/marker rows (`---…`, `===…`) so footers
 *  and section dividers don't inflate the info bucket. */
export function countSeverities(bodyText: string, strict = true): SeverityCounts {
    let errors = 0, warnings = 0, perfs = 0, anrs = 0, infos = 0;
    let debugs = 0, databases = 0, todos = 0, notices = 0;
    const lines = bodyText.split('\n');
    for (const line of lines) {
        if (line.length === 0 || line.startsWith('---') || line.startsWith('===')) { continue; }
        const msg = line.replace(timestampPrefixRe, '');
        // Pass empty category: list scan has no DAP context. stderrTreatAsError is
        // left false here on purpose — the viewer applies it at render time based
        // on per-line DAP categories; we only have plain text.
        const level = classifyLevel(msg, '', strict, false);
        switch (level) {
            case 'error': errors++; break;
            case 'warning': warnings++; break;
            case 'performance': perfs++; if (isAnrLine(msg)) { anrs++; } break;
            case 'debug': debugs++; break;
            case 'database': databases++; break;
            case 'todo': todos++; break;
            case 'notice': notices++; break;
            case 'info':
            default: infos++; break;
        }
    }
    return { errors, warnings, perfs, anrs, infos, debugs, databases, todos, notices };
}

/** Extract the body text from a full log file (everything after the header separator). */
export function extractBody(fullText: string): string {
    const headerEnd = fullText.indexOf('==================');
    if (headerEnd <= 0) { return fullText; }
    const afterSep = fullText.indexOf('\n', headerEnd);
    if (afterSep < 0) { return ''; }
    // Skip the blank line after the separator.
    const bodyStart = fullText.indexOf('\n', afterSep + 1);
    return bodyStart >= 0 ? fullText.slice(bodyStart + 1) : '';
}
