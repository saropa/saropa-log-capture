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

/** Mutable accumulator shared by the sync and chunked counters. */
interface Tally {
    errors: number; warnings: number; perfs: number; anrs: number; infos: number;
    debugs: number; databases: number; todos: number; notices: number;
}

function newTally(): Tally {
    return { errors: 0, warnings: 0, perfs: 0, anrs: 0, infos: 0, debugs: 0, databases: 0, todos: 0, notices: 0 };
}

/** Classify one body line and increment its bucket. Blank lines and bare separator/marker
 *  rows (`---…`, `===…`) are skipped so footers and dividers don't inflate `infos`. */
function tallyLine(line: string, strict: boolean, t: Tally): void {
    if (line.length === 0 || line.startsWith('---') || line.startsWith('===')) { return; }
    const msg = line.replace(timestampPrefixRe, '');
    // Pass empty category: list scan has no DAP context. stderrTreatAsError is left false
    // on purpose — the viewer applies it at render time from per-line DAP categories; here
    // we only have plain text.
    const level = classifyLevel(msg, '', strict, false);
    switch (level) {
        case 'error': t.errors++; break;
        case 'warning': t.warnings++; break;
        case 'performance': t.perfs++; if (isAnrLine(msg)) { t.anrs++; } break;
        case 'debug': t.debugs++; break;
        case 'database': t.databases++; break;
        case 'todo': t.todos++; break;
        case 'notice': t.notices++; break;
        default: t.infos++; break;
    }
}

/** Count error/warning/perf/info/debug/database/todo/notice lines in the body text.
 *  Synchronous — keep for small slices (run summaries). For whole files prefer
 *  {@link countSeveritiesChunked}, which yields so a large log can't block the host. */
export function countSeverities(bodyText: string, strict = true): SeverityCounts {
    const t = newTally();
    for (const line of bodyText.split('\n')) { tallyLine(line, strict, t); }
    return t;
}

/** Identical counts to {@link countSeverities}, but yields to the event loop after every
 *  `chunkLines` lines so scanning a very large log file doesn't peg the extension-host
 *  thread and make VS Code unresponsive (issue #30). `setImmediate` (not `setTimeout`)
 *  drains pending I/O between chunks with minimal added latency; the boundary is checked
 *  AFTER tallying so files under one chunk never pay a yield. */
export async function countSeveritiesChunked(
    bodyText: string, strict = true, chunkLines = 2000,
): Promise<SeverityCounts> {
    const lines = bodyText.split('\n');
    const t = newTally();
    for (let i = 0; i < lines.length; i++) {
        tallyLine(lines[i], strict, t);
        if ((i + 1) % chunkLines === 0) { await new Promise<void>((resolve) => setImmediate(resolve)); }
    }
    return t;
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
