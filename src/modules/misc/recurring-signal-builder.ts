/**
 * Unified recurring signal builder: aggregates ALL signal sources from
 * session metadata into a single RecurringSignalEntry[] list.
 *
 * Sources: error fingerprints, warning fingerprints, perf fingerprints,
 * SQL fingerprints, and signal summary counts (network, memory, etc.).
 * This replaces separate aggregation of recurring errors + signal trends.
 */

import { parseSessionDate, type LoadedMeta } from '../session/metadata-loader';
import {
    accumulateFp, accumulatePerf, accumulateSql,
    accumulateSummaryCounts, accumulateDriftAdvisor,
    type Accum,
} from './signal-accumulator';

/** Every detection type in the unified signal system. */
export type SignalKind = 'error' | 'warning' | 'perf' | 'sql' | 'network' | 'memory' | 'slow-op' | 'anr' | 'permission' | 'classified';

/** Auto-classified severity based on cross-session frequency and signal kind. */
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Trend direction: is this signal getting worse, better, or holding steady? */
export type SignalTrend = 'increasing' | 'stable' | 'decreasing';

/** A signal entry that recurs across multiple sessions — the unified type for all cross-session signals. */
export interface RecurringSignalEntry {
    readonly kind: SignalKind;
    /** Raw identifier for this signal (error hash, SQL pattern, perf op name, etc.). */
    readonly fingerprint: string;
    readonly label: string;
    readonly detail?: string;
    readonly sessionCount: number;
    readonly totalOccurrences: number;
    readonly firstSeen: string;
    readonly lastSeen: string;
    readonly firstSeenVersion?: string;
    readonly lastSeenVersion?: string;
    readonly category?: string;
    readonly avgDurationMs?: number;
    readonly maxDurationMs?: number;
    /** Auto-classified severity based on frequency, kind, and impact. */
    readonly severity: SignalSeverity;
    /** True if this signal appears in 5+ sessions — flagged for attention. */
    readonly recurring: boolean;
    /** Trend direction based on comparing older vs newer half of timeline. */
    readonly trend?: SignalTrend;
    /** Top line indices from the current session for jump-to-line navigation (single-session signals only). */
    readonly lineIndices?: readonly number[];
    readonly timeline: readonly { readonly session: string; readonly count: number }[];
}

const maxSignals = 50;

/** Build a unified list of recurring signals from all metadata sources. */
export function buildAllRecurringSignals(metas: readonly LoadedMeta[]): RecurringSignalEntry[] {
    const map = new Map<string, Accum>();

    for (const { filename, meta } of metas) {
        const ver = meta.appVersion;
        // Error fingerprints → error signals
        for (const fp of meta.fingerprints ?? []) {
            accumulateFp(map, { kind: 'error', fp, session: filename, category: fp.cat, version: ver });
        }
        // Warning fingerprints → warning signals
        for (const fp of meta.warningFingerprints ?? []) {
            accumulateFp(map, { kind: 'warning', fp, session: filename, version: ver });
        }
        // Perf fingerprints → perf signals
        for (const pf of meta.perfFingerprints ?? []) {
            accumulatePerf(map, pf, filename);
        }
        // SQL fingerprints → sql signals
        accumulateSql(map, meta, filename);
        // Signal summary counts → remaining signal kinds (network, memory, etc.)
        accumulateSummaryCounts(map, meta, filename);
        // Drift Advisor integration data → additional signals from DB analysis
        accumulateDriftAdvisor(map, meta, filename);
    }

    return rankSignals(map);
}

const recurringThreshold = 5;

/**
 * Auto-classify severity based on signal kind, cross-session frequency, and category.
 * Fatal/ANR/OOM errors are always critical. Errors in 5+ sessions are high.
 * Warnings and perf issues scale by frequency.
 */
function classifySeverity(kind: SignalKind, sessionCount: number, category?: string): SignalSeverity {
    // Fatal crashes, ANR, OOM are always critical regardless of frequency
    if (category === 'fatal' || category === 'anr' || category === 'oom' || category === 'native') { return 'critical'; }
    if (kind === 'anr') { return 'critical'; }
    // Errors in many sessions are high severity
    if (kind === 'error' && sessionCount >= recurringThreshold) { return 'high'; }
    if (kind === 'error') { return 'medium'; }
    // Classified errors (critical/bug) are high
    if (kind === 'classified') { return 'high'; }
    // Warnings and perf issues scale by frequency
    if (sessionCount >= recurringThreshold) { return 'medium'; }
    return 'low';
}

/**
 * Compute trend by comparing average count in the older half vs newer half of the timeline.
 * Needs 3+ data points to be meaningful — returns undefined otherwise.
 */
function computeTrend(timeline: readonly { count: number }[]): SignalTrend | undefined {
    if (timeline.length < 3) { return undefined; }
    const mid = Math.floor(timeline.length / 2);
    const olderAvg = timeline.slice(0, mid).reduce((s, t) => s + t.count, 0) / mid;
    const newerAvg = timeline.slice(mid).reduce((s, t) => s + t.count, 0) / (timeline.length - mid);
    // 20% threshold to avoid noise — small fluctuations are "stable"
    const ratio = olderAvg > 0 ? newerAvg / olderAvg : newerAvg > 0 ? 2 : 1;
    if (ratio > 1.2) { return 'increasing'; }
    if (ratio < 0.8) { return 'decreasing'; }
    return 'stable';
}

/** Rank signals by cross-session impact and finalize the output. */
function rankSignals(map: Map<string, Accum>): RecurringSignalEntry[] {
    return [...map.entries()]
        .map(([fp, a]) => {
            // Sort timeline chronologically so firstSeen/lastSeen are accurate
            // (metadata iteration order is not guaranteed to be chronological)
            a.timeline.sort((x, y) => parseSessionDate(x.session) - parseSessionDate(y.session));
            const sessionCount = a.timeline.length;
            const sev = classifySeverity(a.kind, sessionCount, a.category);
            return {
                kind: a.kind,
                // Strip the "kind::" prefix so fingerprint is the raw identifier
                // (error hash, SQL pattern, perf op name, etc.)
                fingerprint: fp.replace(/^[^:]+::/, ''),
                label: a.label,
                detail: a.detail,
                sessionCount,
                totalOccurrences: a.total,
                firstSeen: a.timeline[0].session,
                lastSeen: a.timeline[a.timeline.length - 1].session,
                firstSeenVersion: a.firstVer,
                lastSeenVersion: a.lastVer,
                category: a.category,
                avgDurationMs: a.weightedMsSum && a.weightedMsCount
                    ? Math.round(a.weightedMsSum / a.weightedMsCount) : a.avgMs,
                maxDurationMs: a.maxMs,
                severity: sev,
                recurring: sessionCount >= recurringThreshold,
                trend: computeTrend(a.timeline),
                lineIndices: a.lineIdxs,
                timeline: a.timeline,
            };
        })
        // Sort: critical first, then high, then by impact score
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity)
            || (b.sessionCount * b.totalOccurrences) - (a.sessionCount * a.totalOccurrences))
        .slice(0, maxSignals);
}

/** Numeric rank for severity sorting (lower = more severe = sorts first). */
function severityRank(s: SignalSeverity): number {
    if (s === 'critical') { return 0; }
    if (s === 'high') { return 1; }
    if (s === 'medium') { return 2; }
    return 3;
}
