/**
 * Cross-session performance aggregator: build aggregated performance
 * trends from perf fingerprints stored in session metadata.
 */

import { loadFilteredMetas, parseSessionDate, type LoadedMeta, type TimeRange } from './metadata-loader';
import type { PerfFingerprintEntry } from './perf-fingerprint';

/** A tracked performance operation with cross-session timeline. */
export interface PerfTrend {
    readonly name: string;
    readonly timeline: readonly PerfTimelineEntry[];
    readonly overallAvgMs: number;
    readonly overallMinMs: number;
    readonly overallMaxMs: number;
    readonly sessionCount: number;
    readonly trend: 'improving' | 'degrading' | 'stable';
}

/** A single session's data point for one operation. */
export interface PerfTimelineEntry {
    readonly session: string;
    readonly avgMs: number;
    readonly count: number;
    readonly date: number;
}

/** Aggregated cross-session performance insights. */
export interface PerfInsights {
    readonly trends: readonly PerfTrend[];
    readonly sessionCount: number;
    readonly queriedAt: number;
}

const maxTrends = 30;

/** Aggregate performance fingerprints across all session metadata files. */
export async function aggregatePerformance(timeRange: TimeRange = 'all'): Promise<PerfInsights> {
    const filtered = await loadFilteredMetas(timeRange);
    return {
        trends: buildPerfTrends(filtered),
        sessionCount: filtered.length,
        queriedAt: Date.now(),
    };
}

type TrendAccum = { timeline: PerfTimelineEntry[]; allMs: number[] };

function buildPerfTrends(metas: readonly LoadedMeta[]): PerfTrend[] {
    const trendMap = new Map<string, TrendAccum>();
    for (const { filename, meta } of metas) {
        const date = parseSessionDate(filename);
        for (const pf of meta.perfFingerprints ?? []) {
            accumulatePerfEntry(pf, filename, date, trendMap);
        }
    }
    return [...trendMap.entries()]
        .map(([name, accum]) => buildTrend(name, accum))
        .sort((a, b) => (b.sessionCount * b.overallAvgMs) - (a.sessionCount * a.overallAvgMs))
        .slice(0, maxTrends);
}

function accumulatePerfEntry(
    pf: PerfFingerprintEntry, session: string, date: number, map: Map<string, TrendAccum>,
): void {
    let accum = map.get(pf.name);
    if (!accum) { accum = { timeline: [], allMs: [] }; map.set(pf.name, accum); }
    if (!accum.timeline.some(t => t.session === session)) {
        accum.timeline.push({ session, avgMs: pf.avgMs, count: pf.count, date });
    }
    accum.allMs.push(pf.avgMs);
}

function buildTrend(name: string, accum: TrendAccum): PerfTrend {
    const timeline = accum.timeline.sort((a, b) => a.date - b.date);
    const allMs = accum.allMs;
    const sum = allMs.reduce((a, b) => a + b, 0);
    return {
        name,
        timeline,
        overallAvgMs: Math.round(sum / allMs.length),
        overallMinMs: Math.min(...allMs),
        overallMaxMs: Math.max(...allMs),
        sessionCount: timeline.length,
        trend: computeTrend(timeline),
    };
}

/** Compare first-half avg to second-half avg to determine trend direction. */
function computeTrend(timeline: readonly PerfTimelineEntry[]): 'improving' | 'degrading' | 'stable' {
    if (timeline.length < 2) { return 'stable'; }
    const mid = Math.floor(timeline.length / 2);
    const firstAvg = avgOf(timeline.slice(0, mid));
    const lastAvg = avgOf(timeline.slice(mid));
    const change = (lastAvg - firstAvg) / (firstAvg || 1);
    if (change > 0.15) { return 'degrading'; }
    if (change < -0.15) { return 'improving'; }
    return 'stable';
}

function avgOf(entries: readonly PerfTimelineEntry[]): number {
    if (entries.length === 0) { return 0; }
    return entries.reduce((s, e) => s + e.avgMs, 0) / entries.length;
}
