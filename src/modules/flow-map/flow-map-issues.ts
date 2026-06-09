/**
 * Classifies log lines into performance / warning issues for the flow map's issue overlay and the
 * report's issue table (plan 056). Slow queries and repeat batches are detected separately so the
 * parser can aggregate counts and keep only the worst slow query as a table row (135 rows would
 * bury the signal). Warnings are deduped by category upstream.
 */

import type { IssueEvent, IssueSeverity, SourceAnchor } from './flow-map-model';

/** A detected slow query: duration plus the interceptor source anchor and its log line. */
export interface SlowQuery {
    readonly ms: number;
    readonly kind: string;
    readonly source?: SourceAnchor;
    logLine?: number;
}

/** Pull the `(./lib/…/foo.dart:NN:CC)` anchor Drift appends, as a project-relative SourceAnchor. */
function relativeDartAnchor(text: string): SourceAnchor | undefined {
    const m = /\((\.\/[^):]+\.dart):(\d+)/.exec(text);
    if (!m) {
        return undefined;
    }
    return { file: m[1].replace(/^\.\//, ''), line: parseInt(m[2], 10) };
}

/** Detect `Drift SLOW 2830ms INSERT: …`. Returns the duration + kind + anchor, or undefined. */
export function parseSlowQuery(line: string): SlowQuery | undefined {
    const m = /Drift SLOW\s+(\d+)ms\s+(\w+)/.exec(line);
    if (!m) {
        return undefined;
    }
    return { ms: parseInt(m[1], 10), kind: m[2], source: relativeDartAnchor(line) };
}

/** Detect `Drift REPEAT x8 in ≤500ms …` batches (counted, not table rows). */
export function isRepeatBatch(line: string): boolean {
    return /Drift REPEAT\s+x\d+/.test(line);
}

/** Warning matchers: category + severity + human detail. First hit wins; deduped by category. */
const WARNINGS: { re: RegExp; category: string; severity: IssueSeverity; detail: string }[] = [
    {
        re: /apply Kotlin Gradle Plugin \(KGP\)|uses the following plugins that apply Kotlin/,
        category: 'Build',
        severity: 'warn',
        detail: 'Kotlin-Gradle Plugin deprecation',
    },
    {
        re: /OpenStreetMap|OSM Tile Usage|tile servers are not/i,
        category: 'Tiles',
        severity: 'warn',
        detail: 'OpenStreetMap tile-usage policy warning',
    },
    {
        re: /databaseDecode: could not decode/,
        category: 'Decode',
        severity: 'warn',
        detail: 'databaseDecode could not decode JSON',
    },
    {
        re: /getCachedValue\(\) called before cache initialize\(\)/,
        category: 'Cache misuse',
        severity: 'warn',
        detail: 'getCachedValue() called before cache init',
    },
    {
        re: /applyFenceDelta: Unexpected fence/,
        category: 'Render',
        severity: 'warn',
        detail: 'E/FrameEvents: applyFenceDelta unexpected fence',
    },
];

/** Classify a line as a warning IssueEvent, or undefined. Category dedup is the caller's job. */
export function classifyWarning(line: string, tsMs: number, clock: string, logLine: number): IssueEvent | undefined {
    for (const w of WARNINGS) {
        if (w.re.test(line)) {
            return { tsMs, clock, severity: w.severity, category: w.category, detail: w.detail, logLine };
        }
    }
    return undefined;
}
