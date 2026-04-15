/**
 * Insights summary: structured data for export (recurring errors + hot files).
 * Built from CrossSessionSignals with optional caps for large scopes.
 */

import type { CrossSessionSignals, HotFile, RecurringError } from '../misc/cross-session-aggregator';

/** One row for the errors table: signature, count, sessions, sample. */
export interface ErrorSummary {
    readonly signature: string;
    readonly count: number;
    readonly sessions: readonly string[];
    readonly sampleLine: string;
    readonly firstSeen: string;
    readonly lastSeen: string;
    readonly category?: string;
}

/** One row for the files table: path, session count (hot files from correlation tags). */
export interface FileSummary {
    readonly path: string;
    readonly sessionCount: number;
}

/** Full summary for export: errors, files, and meta. */
export interface SignalsSummary {
    readonly errors: readonly ErrorSummary[];
    readonly files: readonly FileSummary[];
    readonly meta: {
        readonly sessionCount: number;
        readonly timeRange: string;
        readonly exportedAt: string;
    };
}

const defaultMaxErrors = 500;
const defaultMaxFiles = 500;

/**
 * Build an exportable summary from cross-session signals.
 * Caps errors and files to avoid huge exports.
 */
export function buildSignalsSummary(
    aggregated: CrossSessionSignals,
    options?: { maxErrors?: number; maxFiles?: number; timeRangeLabel?: string },
): SignalsSummary {
    const maxErrors = options?.maxErrors ?? defaultMaxErrors;
    const maxFiles = options?.maxFiles ?? defaultMaxFiles;
    const timeRangeLabel = options?.timeRangeLabel ?? 'all';

    const errors: ErrorSummary[] = aggregated.recurringErrors.slice(0, maxErrors).map((e: RecurringError) => ({
        signature: e.hash,
        count: e.totalOccurrences,
        sessions: e.timeline.map(t => t.session),
        sampleLine: e.exampleLine,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
        category: e.category,
    }));

    const files: FileSummary[] = aggregated.hotFiles.slice(0, maxFiles).map((f: HotFile) => ({
        path: f.filename,
        sessionCount: f.sessionCount,
    }));

    return {
        errors,
        files,
        meta: {
            sessionCount: aggregated.sessionCount,
            timeRange: timeRangeLabel,
            exportedAt: new Date(aggregated.queriedAt).toISOString(),
        },
    };
}
