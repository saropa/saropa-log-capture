"use strict";
/**
 * Cross-session aggregator: read all sidecar metadata files and build
 * aggregated insights — hot files and recurring error patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInsightsFromMetas = buildInsightsFromMetas;
exports.aggregateInsights = aggregateInsights;
const metadata_loader_1 = require("../session/metadata-loader");
const maxHotFiles = 20;
const maxErrors = 30;
/** Build insights from an existing list of loaded session metas (e.g. for a single session or investigation). */
function buildInsightsFromMetas(metas) {
    const envStats = buildEnvironmentStats(metas);
    return {
        hotFiles: buildHotFiles(metas),
        recurringErrors: buildRecurringErrors(metas),
        sessionCount: metas.length,
        ...envStats,
        queriedAt: Date.now(),
    };
}
/** Aggregate insights across all session metadata files. */
async function aggregateInsights(timeRange = 'all') {
    const filtered = await (0, metadata_loader_1.loadFilteredMetas)(timeRange);
    return buildInsightsFromMetas(filtered);
}
function buildHotFiles(metas) {
    const fileMap = new Map();
    for (const { filename, meta } of metas) {
        for (const tag of meta.correlationTags ?? []) {
            if (!tag.startsWith('file:')) {
                continue;
            }
            const name = tag.slice(5);
            let entry = fileMap.get(name);
            if (!entry) {
                entry = { sessions: [] };
                fileMap.set(name, entry);
            }
            entry.sessions.push({ filename, uri: '' });
        }
    }
    return [...fileMap.entries()]
        .map(([name, { sessions }]) => ({ filename: name, sessionCount: sessions.length, sessions }))
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, maxHotFiles);
}
function buildRecurringErrors(metas) {
    const errorMap = new Map();
    for (const { filename, meta } of metas) {
        const ver = meta.appVersion;
        for (const fp of meta.fingerprints ?? []) {
            accumulateFingerprint(fp, filename, errorMap, ver);
        }
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
function accumulateFingerprint(fp, filename, errorMap, version) {
    const existing = errorMap.get(fp.h);
    if (existing) {
        existing.total += fp.c;
        if (!existing.timeline.some(t => t.session === filename)) {
            existing.timeline.push({ session: filename, count: fp.c });
        }
        if (version) {
            existing.lastVer = version;
        }
    }
    else {
        errorMap.set(fp.h, {
            n: fp.n, e: fp.e, total: fp.c,
            timeline: [{ session: filename, count: fp.c }],
            firstVer: version, lastVer: version, cat: fp.cat,
        });
    }
}
const platformTagRe = /^(?:platform|os|device|runtime)$/i;
const sdkTagRe = /^(?:sdk|flutter|dart|node|python|java|go)/i;
function buildEnvironmentStats(metas) {
    const platformMap = new Map();
    const sdkMap = new Map();
    const adapterMap = new Map();
    for (const { meta } of metas) {
        if (meta.debugAdapterType) {
            incr(adapterMap, meta.debugAdapterType);
        }
        for (const tag of meta.autoTags ?? []) {
            const lower = tag.toLowerCase();
            if (platformTagRe.test(lower.split(':')[0] ?? '')) {
                incr(platformMap, tag);
            }
            else if (sdkTagRe.test(lower.split(':')[0] ?? '') || sdkTagRe.test(lower)) {
                incr(sdkMap, tag);
            }
        }
        for (const tag of meta.tags ?? []) {
            const lower = tag.toLowerCase();
            if (lower.includes('android') || lower.includes('ios') || lower.includes('web') || lower.includes('linux') || lower.includes('macos') || lower.includes('windows')) {
                incr(platformMap, tag);
            }
        }
    }
    return { platforms: toStats(platformMap), sdkVersions: toStats(sdkMap), debugAdapters: toStats(adapterMap) };
}
function incr(map, key) { map.set(key, (map.get(key) ?? 0) + 1); }
function toStats(map) {
    return [...map.entries()].map(([value, sessionCount]) => ({ value, sessionCount })).sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 10);
}
//# sourceMappingURL=cross-session-aggregator.js.map