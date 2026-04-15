/**
 * Signal accumulation functions for the recurring signal builder.
 *
 * Each function aggregates one source of signals (fingerprints, SQL, perf,
 * Drift Advisor, signal summary) into the shared Accum map. The map is
 * then ranked and finalized by recurring-signal-builder.ts.
 */

import type { FingerprintEntry } from '../analysis/error-fingerprint';
import type { PerfFingerprintEntry } from './perf-fingerprint';
import { isPersistedDriftSqlFingerprintSummaryV1 } from '../db/drift-sql-fingerprint-summary-persist';
import type { PersistedDriftSqlFingerprintEntryV1 } from '../db/drift-sql-fingerprint-summary-persist';
import { isPersistedSignalSummaryV1 } from '../root-cause-hints/signal-summary-types';
import type { PersistedSignalEntryV2 } from '../root-cause-hints/signal-summary-types';
import type { LoadedMeta } from '../session/metadata-loader';
import type { SignalKind } from './recurring-signal-builder';

/** Internal accumulator state for a single signal across sessions. */
export type Accum = {
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

/** Params for accumulating a fingerprint entry. */
interface FpAccumOpts {
    readonly kind: SignalKind; readonly fp: FingerprintEntry;
    readonly session: string; readonly category?: string; readonly version?: string;
}

/** Accumulate an error or warning fingerprint entry, tracking app version for regression info. */
export function accumulateFp(map: Map<string, Accum>, opts: FpAccumOpts): void {
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
export function accumulatePerf(map: Map<string, Accum>, pf: PerfFingerprintEntry, session: string): void {
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
export function accumulateSql(map: Map<string, Accum>, meta: LoadedMeta['meta'], session: string): void {
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
export function accumulateSummaryCounts(map: Map<string, Accum>, meta: LoadedMeta['meta'], session: string): void {
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
export function accumulateDriftAdvisor(map: Map<string, Accum>, meta: LoadedMeta['meta'], session: string): void {
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
