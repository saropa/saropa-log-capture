/**
 * Unified recurring signal builder: aggregates ALL signal sources from
 * session metadata into a single RecurringSignalEntry[] list.
 *
 * Sources: error fingerprints, warning fingerprints, perf fingerprints,
 * SQL fingerprints, and signal summary counts (network, memory, etc.).
 * This replaces separate aggregation of recurring errors + signal trends.
 */

import type { FingerprintEntry } from '../analysis/error-fingerprint';
import type { PerfFingerprintEntry } from './perf-fingerprint';
import { isPersistedDriftSqlFingerprintSummaryV1 } from '../db/drift-sql-fingerprint-summary-persist';
import type { PersistedDriftSqlFingerprintEntryV1 } from '../db/drift-sql-fingerprint-summary-persist';
import { isPersistedSignalSummaryV1 } from '../root-cause-hints/signal-summary-types';
import type { PersistedSignalEntryV2 } from '../root-cause-hints/signal-summary-types';
import { parseSessionDate, type LoadedMeta } from '../session/metadata-loader';

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

type Accum = {
    kind: SignalKind; label: string; detail?: string; total: number;
    timeline: { session: string; count: number }[];
    category?: string; avgMs?: number; maxMs?: number;
    /** Running weighted sum for avgMs aggregation across sessions. */
    weightedMsSum?: number; weightedMsCount?: number;
    /** App version from the first and last session where this signal appeared. */
    firstVer?: string; lastVer?: string;
    /** Top line indices from V2 entries (for single-session jump-to-line). */
    lineIdxs?: number[];
};

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

/** Params for accumulating a fingerprint entry. */
interface FpAccumOpts {
    readonly kind: SignalKind; readonly fp: FingerprintEntry;
    readonly session: string; readonly category?: string; readonly version?: string;
}

/** Accumulate an error or warning fingerprint entry, tracking app version for regression info. */
function accumulateFp(map: Map<string, Accum>, opts: FpAccumOpts): void {
    const { kind, fp, session, category, version } = opts;
    const key = `${kind}::${fp.h}`;
    const existing = map.get(key);
    if (existing) {
        existing.total += fp.c;
        if (!existing.timeline.some(t => t.session === session)) {
            existing.timeline.push({ session, count: fp.c });
        }
        if (version) { existing.lastVer = version; }
    } else {
        map.set(key, {
            kind, label: fp.n, detail: fp.e, total: fp.c,
            timeline: [{ session, count: fp.c }], category,
            firstVer: version, lastVer: version,
        });
    }
}

/** Accumulate a perf fingerprint entry, tracking weighted avg duration. */
function accumulatePerf(map: Map<string, Accum>, pf: PerfFingerprintEntry, session: string): void {
    const key = `perf::${pf.name}`;
    const existing = map.get(key);
    if (existing) {
        existing.total += pf.count;
        if (!existing.timeline.some(t => t.session === session)) {
            existing.timeline.push({ session, count: pf.count });
        }
        // Weighted average duration across sessions
        existing.weightedMsSum = (existing.weightedMsSum ?? 0) + pf.avgMs * pf.count;
        existing.weightedMsCount = (existing.weightedMsCount ?? 0) + pf.count;
        existing.maxMs = Math.max(existing.maxMs ?? 0, pf.maxMs);
    } else {
        map.set(key, {
            kind: 'perf', label: pf.name, detail: pf.stack?.slice(0, 100),
            total: pf.count, timeline: [{ session, count: pf.count }],
            avgMs: pf.avgMs, maxMs: pf.maxMs,
            weightedMsSum: pf.avgMs * pf.count, weightedMsCount: pf.count,
        });
    }
}

/** Accumulate SQL fingerprint entries from the Drift summary. */
function accumulateSql(map: Map<string, Accum>, meta: LoadedMeta['meta'], session: string): void {
    const summary = meta.driftSqlFingerprintSummary;
    if (!summary || !isPersistedDriftSqlFingerprintSummaryV1(summary)) { return; }
    for (const [sqlFp, entry] of Object.entries(summary.fingerprints)) {
        accumulateSqlEntry(map, sqlFp, entry, session);
    }
}

/** Accumulate a single SQL fingerprint entry. */
function accumulateSqlEntry(map: Map<string, Accum>, sqlFp: string, entry: PersistedDriftSqlFingerprintEntryV1, session: string): void {
    const key = `sql::${sqlFp}`;
    const existing = map.get(key);
    if (existing) {
        existing.total += entry.count;
        if (!existing.timeline.some(t => t.session === session)) {
            existing.timeline.push({ session, count: entry.count });
        }
        if (entry.avgDurationMs !== undefined && entry.durationSampleCount) {
            existing.weightedMsSum = (existing.weightedMsSum ?? 0) + entry.avgDurationMs * entry.durationSampleCount;
            existing.weightedMsCount = (existing.weightedMsCount ?? 0) + entry.durationSampleCount;
        }
        existing.maxMs = Math.max(existing.maxMs ?? 0, entry.maxDurationMs ?? 0);
    } else {
        map.set(key, {
            kind: 'sql', label: sqlFp, total: entry.count,
            timeline: [{ session, count: entry.count }],
            avgMs: entry.avgDurationMs, maxMs: entry.maxDurationMs,
            weightedMsSum: entry.avgDurationMs !== undefined && entry.durationSampleCount
                ? entry.avgDurationMs * entry.durationSampleCount : undefined,
            weightedMsCount: entry.durationSampleCount,
        });
    }
}

/** Accumulate ANR risk as its own signal when risk level is medium or high. */
function accumulateAnrRisk(map: Map<string, Accum>, level: string, session: string): void {
    const key = 'anr::risk';
    const existing = map.get(key);
    if (existing) {
        existing.total++;
        if (!existing.timeline.some(t => t.session === session)) { existing.timeline.push({ session, count: 1 }); }
    } else {
        map.set(key, { kind: 'anr', label: 'ANR risk', total: 1, timeline: [{ session, count: 1 }], category: level });
    }
}

/** Accumulate a V2 signal entry with full detail (label, fingerprint, duration, line indices). */
function accumulateV2Entry(map: Map<string, Accum>, entry: PersistedSignalEntryV2, session: string): void {
    const kind = entry.kind as SignalKind;
    const key = `${kind}::${entry.fingerprint}`;
    const existing = map.get(key);
    if (existing) {
        existing.total += entry.count;
        if (!existing.timeline.some(t => t.session === session)) { existing.timeline.push({ session, count: entry.count }); }
        // Aggregate duration stats across sessions (weighted avg, running max)
        if (entry.avgDurationMs !== undefined) {
            existing.weightedMsSum = (existing.weightedMsSum ?? 0) + entry.avgDurationMs * entry.count;
            existing.weightedMsCount = (existing.weightedMsCount ?? 0) + entry.count;
        }
        if (entry.maxDurationMs !== undefined) { existing.maxMs = Math.max(existing.maxMs ?? 0, entry.maxDurationMs); }
    } else {
        const lines = entry.lineIndices ? [...entry.lineIndices] : undefined;
        const wSum = entry.avgDurationMs !== undefined ? entry.avgDurationMs * entry.count : undefined;
        map.set(key, { kind, label: entry.label, detail: entry.detail, total: entry.count, timeline: [{ session, count: entry.count }], category: entry.category, avgMs: entry.avgDurationMs, maxMs: entry.maxDurationMs, weightedMsSum: wSum, weightedMsCount: wSum !== undefined ? entry.count : undefined, lineIdxs: lines });
    }
}

/** V1 fallback: accumulate count-only signals grouped by kind (no detail). */
function accumulateV1CountSignal(map: Map<string, Accum>, kind: SignalKind, val: number, session: string): void {
    const key = `${kind}::count`;
    const existing = map.get(key);
    if (existing) {
        existing.total += val;
        if (!existing.timeline.some(t => t.session === session)) { existing.timeline.push({ session, count: val }); }
    } else {
        map.set(key, { kind, label: kind, total: val, timeline: [{ session, count: val }] });
    }
}

/** Signal summary signals (network, memory, slow-op, etc.) + ANR risk.
 *  V2 summaries have actual entries; V1 only has counts (fall back to count-based aggregation). */
function accumulateSummaryCounts(map: Map<string, Accum>, meta: LoadedMeta['meta'], session: string): void {
    const s = meta.signalSummary;
    if (!s || !isPersistedSignalSummaryV1(s)) { return; }
    // V2 adds an `entries` field — access via unknown cast since V1 type doesn't declare it
    const v2Entries = (s as unknown as { entries?: readonly PersistedSignalEntryV2[] }).entries;
    if (Array.isArray(v2Entries) && v2Entries.length > 0) {
        for (const entry of v2Entries) { accumulateV2Entry(map, entry, session); }
    } else {
        // V1 fallback: count-only signals grouped by kind
        const countKinds: [string, SignalKind][] = [
            ['networkFailures', 'network'], ['memoryEvents', 'memory'],
            ['slowOperations', 'slow-op'], ['permissionDenials', 'permission'],
            ['classifiedErrors', 'classified'],
        ];
        for (const [field, kind] of countKinds) {
            const val = (s.counts as Record<string, number | undefined>)[field];
            if (typeof val === 'number' && val > 0) { accumulateV1CountSignal(map, kind, val, session); }
        }
    }
    if (s.anrRiskLevel && s.anrRiskLevel !== 'low') { accumulateAnrRisk(map, s.anrRiskLevel, session); }
}

/** Accumulate a single Drift Advisor slow query row. */
function accumulateDaSlowQuery(map: Map<string, Accum>, row: unknown, session: string): void {
    if (!row || typeof row !== 'object') { return; }
    const r = row as Record<string, unknown>;
    const sql = typeof r.sql === 'string' ? r.sql : '';
    const dur = typeof r.durationMs === 'number' ? r.durationMs : 0;
    if (!sql || dur <= 0) { return; }
    const key = `sql::da-slow::${sql.slice(0, 80).toLowerCase().replace(/\s+/g, ' ')}`;
    const existing = map.get(key);
    if (existing) {
        existing.total++;
        if (!existing.timeline.some(t => t.session === session)) { existing.timeline.push({ session, count: 1 }); }
        existing.maxMs = Math.max(existing.maxMs ?? 0, dur);
    } else {
        map.set(key, { kind: 'sql', label: sql.slice(0, 120), detail: 'Drift Advisor: slow query', total: 1, timeline: [{ session, count: 1 }], maxMs: dur, avgMs: dur });
    }
}

/** Extract Drift Advisor signals from the integration payload (slow queries, issues). */
function accumulateDriftAdvisor(map: Map<string, Accum>, meta: LoadedMeta['meta'], session: string): void {
    const da = meta.integrations?.['saropa-drift-advisor'] as Record<string, unknown> | undefined;
    if (!da || typeof da !== 'object') { return; }
    // Top slow queries from Drift Advisor performance data
    const topSlow = (da.performance as Record<string, unknown> | undefined)?.topSlow;
    if (Array.isArray(topSlow)) {
        for (const row of topSlow) { accumulateDaSlowQuery(map, row, session); }
    }
    // Drift Advisor issues — lint-like diagnostics from the DA extension
    const iss = da.issuesSummary as Record<string, unknown> | undefined;
    if (iss && typeof iss.count === 'number' && iss.count > 0) {
        const key = 'classified::drift-advisor-issues';
        const count = iss.count as number;
        const bySev = iss.bySeverity as Record<string, number> | undefined;
        const detail = bySev ? Object.entries(bySev).filter(([, c]) => c > 0).map(([s, c]) => `${c} ${s}`).join(', ') : `${count} issue(s)`;
        const existing = map.get(key);
        if (existing) {
            existing.total += count;
            if (!existing.timeline.some(t => t.session === session)) { existing.timeline.push({ session, count }); }
        } else {
            map.set(key, { kind: 'classified', label: 'Drift Advisor issues', detail, total: count, timeline: [{ session, count }] });
        }
    }
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
