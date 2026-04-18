/**
 * Cross-session aggregator: read all sidecar metadata files and build
 * aggregated signals — hot files and unified recurring signal patterns.
 */

import { loadFilteredMetas, type LoadedMeta, type TimeRange } from '../session/metadata-loader';
import { buildAllRecurringSignals } from './recurring-signal-builder';
import { detectCoOccurrences, type SignalCoOccurrence } from './signal-co-occurrence';
export type { RecurringSignalEntry, SignalKind } from './recurring-signal-builder';
export type { SignalCoOccurrence } from './signal-co-occurrence';
export type { TimeRange } from '../session/metadata-loader';

/** A source file mentioned across multiple sessions. */
export interface HotFile {
    readonly filename: string;
    readonly sessionCount: number;
    readonly sessions: readonly { readonly filename: string; readonly uri: string }[];
}

/** Environment distribution entry from session headers. */
export interface EnvironmentStat {
    readonly value: string;
    readonly sessionCount: number;
}

/** Aggregated cross-session signals. */
export interface CrossSessionSignals {
    readonly hotFiles: readonly HotFile[];
    /** Unified signal list: errors, warnings, perf, SQL, network, memory, etc. all in one. */
    readonly allSignals: readonly import('./recurring-signal-builder').RecurringSignalEntry[];
    /** Signal pairs that consistently co-occur in the same sessions (Jaccard > 0.5). */
    readonly coOccurrences: readonly SignalCoOccurrence[];
    readonly sessionCount: number;
    readonly platforms: readonly EnvironmentStat[];
    readonly sdkVersions: readonly EnvironmentStat[];
    readonly debugAdapters: readonly EnvironmentStat[];
    readonly queriedAt: number;
}

const maxHotFiles = 20;

/** Build signals from an existing list of loaded session metas (e.g. for a single session or collection). */
export function buildSignalsFromMetas(metas: readonly LoadedMeta[]): CrossSessionSignals {
    const envStats = buildEnvironmentStats(metas);
    const allSignals = buildAllRecurringSignals(metas);
    return {
        hotFiles: buildHotFiles(metas),
        allSignals,
        coOccurrences: detectCoOccurrences(allSignals),
        sessionCount: metas.length,
        ...envStats,
        queriedAt: Date.now(),
    };
}

/** Aggregate signals across all session metadata files. */
export async function aggregateSignals(timeRange: TimeRange = 'all'): Promise<CrossSessionSignals> {
    const filtered = await loadFilteredMetas(timeRange);
    return buildSignalsFromMetas(filtered);
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
