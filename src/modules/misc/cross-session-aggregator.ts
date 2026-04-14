/**
 * Cross-session aggregator: read all sidecar metadata files and build
 * aggregated insights — hot files and recurring error patterns.
 */

import type { CrashCategory, FingerprintEntry } from '../analysis/error-fingerprint';
import { loadFilteredMetas, type LoadedMeta, type TimeRange } from '../session/metadata-loader';
import { isPersistedSignalSummaryV1 } from '../root-cause-hints/signal-summary-types';
import type { SignalSummaryCounts } from '../root-cause-hints/signal-summary-types';
import { buildAllRecurringSignals } from './recurring-signal-builder';
export type { RecurringSignalEntry, SignalKind } from './recurring-signal-builder';
export type { TimeRange } from '../session/metadata-loader';

/** A source file mentioned across multiple sessions. */
export interface HotFile {
    readonly filename: string;
    readonly sessionCount: number;
    readonly sessions: readonly { readonly filename: string; readonly uri: string }[];
}

/** A recurring error group across sessions. */
export interface RecurringError {
    readonly hash: string;
    readonly normalizedText: string;
    readonly exampleLine: string;
    readonly sessionCount: number;
    readonly totalOccurrences: number;
    readonly firstSeen: string;
    readonly lastSeen: string;
    readonly firstSeenVersion?: string;
    readonly lastSeenVersion?: string;
    readonly category?: CrashCategory;
    readonly timeline: readonly { readonly session: string; readonly count: number }[];
}

/** Environment distribution entry from session headers. */
export interface EnvironmentStat {
    readonly value: string;
    readonly sessionCount: number;
}

/** A signal type that recurs across multiple sessions. */
export interface RecurringSignal {
    readonly signalType: keyof SignalSummaryCounts;
    readonly sessionCount: number;
    readonly totalOccurrences: number;
}

/** An N+1 query fingerprint seen across multiple sessions. */
export interface RecurringNPlusOne {
    readonly fingerprint: string;
    readonly sessionCount: number;
}

/** Aggregated cross-session insights. */
export interface CrossSessionInsights {
    readonly hotFiles: readonly HotFile[];
    readonly recurringErrors: readonly RecurringError[];
    readonly recurringSignals: readonly RecurringSignal[];
    readonly recurringNPlusOnes: readonly RecurringNPlusOne[];
    /** Unified signal list: errors, warnings, perf, SQL, network, memory, etc. all in one. */
    readonly allSignals: readonly import('./recurring-signal-builder').RecurringSignalEntry[];
    /** Number of sessions that had signal summary data (viewer was opened). */
    readonly signalSessionCount: number;
    readonly sessionCount: number;
    readonly platforms: readonly EnvironmentStat[];
    readonly sdkVersions: readonly EnvironmentStat[];
    readonly debugAdapters: readonly EnvironmentStat[];
    readonly queriedAt: number;
}

const maxHotFiles = 20;
const maxErrors = 30;

/** Build insights from an existing list of loaded session metas (e.g. for a single session or investigation). */
export function buildInsightsFromMetas(metas: readonly LoadedMeta[]): CrossSessionInsights {
    const envStats = buildEnvironmentStats(metas);
    const signalData = buildRecurringSignals(metas);
    return {
        hotFiles: buildHotFiles(metas),
        recurringErrors: buildRecurringErrors(metas),
        recurringSignals: signalData.signals,
        recurringNPlusOnes: signalData.nPlusOnes,
        allSignals: buildAllRecurringSignals(metas),
        signalSessionCount: signalData.count,
        sessionCount: metas.length,
        ...envStats,
        queriedAt: Date.now(),
    };
}

/** Aggregate insights across all session metadata files. */
export async function aggregateInsights(timeRange: TimeRange = 'all'): Promise<CrossSessionInsights> {
    const filtered = await loadFilteredMetas(timeRange);
    return buildInsightsFromMetas(filtered);
}

function buildHotFiles(metas: readonly LoadedMeta[]): HotFile[] {
    const fileMap = new Map<string, { sessions: { filename: string; uri: string }[] }>();
    for (const { filename, meta } of metas) {
        for (const tag of meta.correlationTags ?? []) {
            if (!tag.startsWith('file:')) { continue; }
            const name = tag.slice(5);
            let entry = fileMap.get(name);
            if (!entry) { entry = { sessions: [] }; fileMap.set(name, entry); }
            entry.sessions.push({ filename, uri: '' });
        }
    }
    return [...fileMap.entries()]
        .map(([name, { sessions }]) => ({ filename: name, sessionCount: sessions.length, sessions }))
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, maxHotFiles);
}

type ErrorAccum = {
    n: string; e: string; total: number;
    timeline: { session: string; count: number }[];
    firstVer?: string; lastVer?: string;
    cat?: CrashCategory;
};

function buildRecurringErrors(metas: readonly LoadedMeta[]): RecurringError[] {
    const errorMap = new Map<string, ErrorAccum>();
    for (const { filename, meta } of metas) {
        const ver = meta.appVersion;
        for (const fp of meta.fingerprints ?? []) { accumulateFingerprint(fp, filename, errorMap, ver); }
    }
    return [...errorMap.entries()]
        .map(([hash, { n, e, total, timeline, firstVer, lastVer, cat }]) => ({
            hash, normalizedText: n, exampleLine: e,
            sessionCount: timeline.length, totalOccurrences: total,
            firstSeen: timeline[0].session, lastSeen: timeline[timeline.length - 1].session,
            firstSeenVersion: firstVer, lastSeenVersion: lastVer,
            category: cat, timeline,
        }))
        .sort((a, b) => (b.sessionCount * b.totalOccurrences) - (a.sessionCount * a.totalOccurrences))
        .slice(0, maxErrors);
}

function accumulateFingerprint(fp: FingerprintEntry, filename: string, errorMap: Map<string, ErrorAccum>, version?: string): void {
    const existing = errorMap.get(fp.h);
    if (existing) {
        existing.total += fp.c;
        if (!existing.timeline.some(t => t.session === filename)) { existing.timeline.push({ session: filename, count: fp.c }); }
        if (version) { existing.lastVer = version; }
    } else {
        errorMap.set(fp.h, {
            n: fp.n, e: fp.e, total: fp.c,
            timeline: [{ session: filename, count: fp.c }],
            firstVer: version, lastVer: version, cat: fp.cat,
        });
    }
}

const maxNPlusOnes = 10;

/** Aggregate signal summaries across sessions into recurring signal types and N+1 fingerprints. */
function buildRecurringSignals(metas: readonly LoadedMeta[]): { signals: RecurringSignal[]; nPlusOnes: RecurringNPlusOne[]; count: number } {
    const signalMap = new Map<keyof SignalSummaryCounts, { sessions: number; total: number }>();
    const n1Map = new Map<string, number>();
    let count = 0;
    for (const { meta } of metas) {
        const s = meta.signalSummary;
        if (!s || !isPersistedSignalSummaryV1(s)) { continue; }
        count++;
        for (const [key, val] of Object.entries(s.counts)) {
            if (typeof val !== 'number' || val <= 0) { continue; }
            const k = key as keyof SignalSummaryCounts;
            const existing = signalMap.get(k) ?? { sessions: 0, total: 0 };
            existing.sessions++;
            existing.total += val;
            signalMap.set(k, existing);
        }
        for (const fp of s.topNPlusOneFingerprints ?? []) {
            n1Map.set(fp, (n1Map.get(fp) ?? 0) + 1);
        }
    }
    const signals = [...signalMap.entries()]
        .map(([signalType, { sessions, total }]) => ({ signalType, sessionCount: sessions, totalOccurrences: total }))
        .sort((a, b) => b.sessionCount - a.sessionCount);
    const nPlusOnes = [...n1Map.entries()]
        .map(([fingerprint, sessionCount]) => ({ fingerprint, sessionCount }))
        .filter(e => e.sessionCount >= 2)
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, maxNPlusOnes);
    return { signals, nPlusOnes, count };
}

const platformTagRe = /^(?:platform|os|device|runtime)$/i;
const sdkTagRe = /^(?:sdk|flutter|dart|node|python|java|go)/i;

function buildEnvironmentStats(metas: readonly LoadedMeta[]): { platforms: EnvironmentStat[]; sdkVersions: EnvironmentStat[]; debugAdapters: EnvironmentStat[] } {
    const platformMap = new Map<string, number>();
    const sdkMap = new Map<string, number>();
    const adapterMap = new Map<string, number>();
    for (const { meta } of metas) {
        if (meta.debugAdapterType) { incr(adapterMap, meta.debugAdapterType); }
        for (const tag of meta.autoTags ?? []) {
            const lower = tag.toLowerCase();
            if (platformTagRe.test(lower.split(':')[0] ?? '')) { incr(platformMap, tag); }
            else if (sdkTagRe.test(lower.split(':')[0] ?? '') || sdkTagRe.test(lower)) { incr(sdkMap, tag); }
        }
        for (const tag of meta.tags ?? []) {
            const lower = tag.toLowerCase();
            if (lower.includes('android') || lower.includes('ios') || lower.includes('web') || lower.includes('linux') || lower.includes('macos') || lower.includes('windows')) { incr(platformMap, tag); }
        }
    }
    return { platforms: toStats(platformMap), sdkVersions: toStats(sdkMap), debugAdapters: toStats(adapterMap) };
}

function incr(map: Map<string, number>, key: string): void { map.set(key, (map.get(key) ?? 0) + 1); }

function toStats(map: Map<string, number>): EnvironmentStat[] {
    return [...map.entries()].map(([value, sessionCount]) => ({ value, sessionCount })).sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 10);
}
