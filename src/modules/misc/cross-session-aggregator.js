"use strict";
/**
 * Cross-session aggregator: read all sidecar metadata files and build
 * aggregated signals — hot files and unified recurring signal patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSignalsFromMetas = buildSignalsFromMetas;
exports.aggregateSignals = aggregateSignals;
const metadata_loader_1 = require("../session/metadata-loader");
const recurring_signal_builder_1 = require("./recurring-signal-builder");
const signal_co_occurrence_1 = require("./signal-co-occurrence");
const maxHotFiles = 20;
/** Build signals from an existing list of loaded session metas (e.g. for a single session or collection). */
function buildSignalsFromMetas(metas) {
    const envStats = buildEnvironmentStats(metas);
    const allSignals = (0, recurring_signal_builder_1.buildAllRecurringSignals)(metas);
    return {
        hotFiles: buildHotFiles(metas),
        allSignals,
        coOccurrences: (0, signal_co_occurrence_1.detectCoOccurrences)(allSignals),
        sessionCount: metas.length,
        ...envStats,
        queriedAt: Date.now(),
    };
}
/** Aggregate signals across all session metadata files. */
async function aggregateSignals(timeRange = 'all') {
    const filtered = await (0, metadata_loader_1.loadFilteredMetas)(timeRange);
    return buildSignalsFromMetas(filtered);
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