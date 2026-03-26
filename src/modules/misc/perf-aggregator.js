"use strict";
/**
 * Cross-session performance aggregator: build aggregated performance
 * trends from perf fingerprints stored in session metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregatePerformance = aggregatePerformance;
const metadata_loader_1 = require("../session/metadata-loader");
const maxTrends = 30;
/** Aggregate performance fingerprints across all session metadata files. */
async function aggregatePerformance(timeRange = 'all') {
    const filtered = await (0, metadata_loader_1.loadFilteredMetas)(timeRange);
    return {
        trends: buildPerfTrends(filtered),
        sessionCount: filtered.length,
        queriedAt: Date.now(),
    };
}
function buildPerfTrends(metas) {
    const trendMap = new Map();
    for (const { filename, meta } of metas) {
        const date = (0, metadata_loader_1.parseSessionDate)(filename);
        for (const pf of meta.perfFingerprints ?? []) {
            accumulatePerfEntry(pf, filename, date, trendMap);
        }
    }
    return [...trendMap.entries()]
        .map(([name, accum]) => buildTrend(name, accum))
        .sort((a, b) => (b.sessionCount * b.overallAvgMs) - (a.sessionCount * a.overallAvgMs))
        .slice(0, maxTrends);
}
function accumulatePerfEntry(pf, session, date, map) {
    let accum = map.get(pf.name);
    if (!accum) {
        accum = { timeline: [], allMs: [] };
        map.set(pf.name, accum);
    }
    if (!accum.timeline.some(t => t.session === session)) {
        accum.timeline.push({ session, avgMs: pf.avgMs, count: pf.count, date });
    }
    accum.allMs.push(pf.avgMs);
}
function buildTrend(name, accum) {
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
function computeTrend(timeline) {
    if (timeline.length < 2) {
        return 'stable';
    }
    const mid = Math.floor(timeline.length / 2);
    const firstAvg = avgOf(timeline.slice(0, mid));
    const lastAvg = avgOf(timeline.slice(mid));
    const change = (lastAvg - firstAvg) / (firstAvg || 1);
    if (change > 0.15) {
        return 'degrading';
    }
    if (change < -0.15) {
        return 'improving';
    }
    return 'stable';
}
function avgOf(entries) {
    if (entries.length === 0) {
        return 0;
    }
    return entries.reduce((s, e) => s + e.avgMs, 0) / entries.length;
}
//# sourceMappingURL=perf-aggregator.js.map