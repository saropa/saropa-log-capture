/**
 * Signals summary: structured data for export (unified signals + hot files).
 * Built from CrossSessionSignals with optional caps for large scopes.
 */

import type { CrossSessionSignals, HotFile } from '../misc/cross-session-aggregator';
import type { RecurringSignalEntry } from '../misc/recurring-signal-builder';

/** One row for the signals table: signature, count, sessions, sample. */
export interface ErrorSummary {
    readonly signature: string;
    readonly count: number;
    readonly sessions: readonly string[];
    readonly sampleLine: string;
    readonly firstSeen: string;
    readonly lastSeen: string;
    readonly category?: string;
    readonly kind?: string;
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

    // Export all signal kinds, not just errors — gives full picture in exports
    const errors: ErrorSummary[] = aggregated.allSignals.slice(0, maxErrors).map((s: RecurringSignalEntry) => ({
        signature: s.fingerprint,
        count: s.totalOccurrences,
        sessions: s.timeline.map(t => t.session),
        sampleLine: s.detail ?? s.label,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
        category: s.category,
        kind: s.kind,
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
