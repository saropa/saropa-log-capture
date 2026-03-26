"use strict";
/**
 * DB detector orchestration (plan **DB_15**). Used by the extension host (session compare, tests) and mirrored
 * in the webview embed for streaming ingest.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SESSION_DB_COMPARE_REGISTRY = exports.mergeDbDetectorResultsByStableKey = void 0;
exports.runDefaultSessionDbCompareDetectors = runDefaultSessionDbCompareDetectors;
exports.runDbDetectorsIngest = runDbDetectorsIngest;
exports.runDbDetectorsCompare = runDbDetectorsCompare;
exports.createDbDetectorSessionState = createDbDetectorSessionState;
exports.applyDbAnnotateLineResultToLineItems = applyDbAnnotateLineResultToLineItems;
exports.applyDbAnnotateLineResultsToLineItems = applyDbAnnotateLineResultsToLineItems;
const db_fingerprint_summary_1 = require("./db-fingerprint-summary");
const drift_db_baseline_volume_compare_detector_1 = require("./drift-db-baseline-volume-compare-detector");
const db_detector_merge_stable_key_1 = require("./db-detector-merge-stable-key");
Object.defineProperty(exports, "mergeDbDetectorResultsByStableKey", { enumerable: true, get: function () { return db_detector_merge_stable_key_1.mergeDbDetectorResultsByStableKey; } });
/** Default registry for log comparison: baseline volume markers (`createBaselineVolumeCompareDetector`). */
exports.DEFAULT_SESSION_DB_COMPARE_REGISTRY = [
    (0, drift_db_baseline_volume_compare_detector_1.createBaselineVolumeCompareDetector)(),
];
/** Run **`DEFAULT_SESSION_DB_COMPARE_REGISTRY`** (session compare panel / `compareLogSessionsWithDbFingerprints`). */
function runDefaultSessionDbCompareDetectors(maps, state, options) {
    return runDbDetectorsCompare(exports.DEFAULT_SESSION_DB_COMPARE_REGISTRY, maps, state, options);
}
function sortDetectors(defs) {
    return [...defs].sort((a, b) => a.priority - b.priority);
}
/**
 * Run all registered detectors (sorted by priority ascending), swallow errors per detector,
 * disable failing detectors until state is reset.
 */
function runDbDetectorsIngest(registry, ctx, state, options) {
    if (options?.insightsEnabled === false) {
        return [];
    }
    const collected = [];
    for (const d of sortDetectors(registry)) {
        if (state.disabledDetectorIds.has(d.id)) {
            continue;
        }
        try {
            const chunk = d.feed(ctx);
            if (chunk?.length) {
                collected.push(...chunk);
            }
        }
        catch (e) {
            if (!state.loggedDetectorErrors.has(d.id)) {
                state.loggedDetectorErrors.add(d.id);
                console.warn(`[saropa] db detector disabled: ${d.id}`, e);
            }
            state.disabledDetectorIds.add(d.id);
        }
    }
    return (0, db_detector_merge_stable_key_1.mergeDbDetectorResultsByStableKey)(collected);
}
/**
 * Batch compare pass (DB_10): runs optional `compare` hooks with a shared diff list.
 * Detectors without `compare` are skipped; merge rules match `runDbDetectorsIngest`.
 */
function runDbDetectorsCompare(registry, maps, state, options) {
    if (options?.insightsEnabled === false) {
        return [];
    }
    const { baseline, target } = maps;
    const diff = (0, db_fingerprint_summary_1.buildDbFingerprintSummaryDiff)(baseline, target);
    const input = { baseline, target, diff };
    const collected = [];
    for (const d of sortDetectors(registry)) {
        if (!d.compare) {
            continue;
        }
        if (state.disabledDetectorIds.has(d.id)) {
            continue;
        }
        try {
            const chunk = d.compare(input);
            if (chunk?.length) {
                collected.push(...chunk);
            }
        }
        catch (e) {
            if (!state.loggedDetectorErrors.has(d.id)) {
                state.loggedDetectorErrors.add(d.id);
                console.warn(`[saropa] db detector compare disabled: ${d.id}`, e);
            }
            state.disabledDetectorIds.add(d.id);
        }
    }
    const merged = (0, db_detector_merge_stable_key_1.mergeDbDetectorResultsByStableKey)(collected);
    const lines = options?.annotateTargetLines;
    if (lines !== undefined && lines.length > 0) {
        applyDbAnnotateLineResultsToLineItems(lines, merged, options?.onAnnotateHeightDelta);
    }
    return merged;
}
function createDbDetectorSessionState() {
    return {
        disabledDetectorIds: new Set(),
        loggedDetectorErrors: new Set(),
    };
}
function isAnnotateLinePayload(p) {
    if (p === null || typeof p !== "object") {
        return false;
    }
    const o = p;
    return (typeof o.targetSeq === "number" &&
        Number.isFinite(o.targetSeq) &&
        o.patch !== null &&
        typeof o.patch === "object");
}
/**
 * Apply one **`annotate-line`** result to in-memory line rows (extension host, tests, or batch previews).
 * Matches embed **`applyDbAnnotateLineResult`** semantics: shallow merge, optional **`totalHeight`** delta via callback.
 *
 * @returns whether a row was found and patched
 */
function applyDbAnnotateLineResultToLineItems(lines, result, onHeightDelta) {
    if (result.kind !== "annotate-line" || !isAnnotateLinePayload(result.payload)) {
        return false;
    }
    const { targetSeq, patch } = result.payload;
    const line = lines.find((x) => x.seq === targetSeq);
    if (!line) {
        return false;
    }
    const oldH = typeof line.height === "number" ? line.height : 0;
    const rec = line;
    for (const [key, val] of Object.entries(patch)) {
        rec[key] = val;
    }
    const newH = patch.height;
    if (typeof newH === "number" && Number.isFinite(newH) && newH !== oldH) {
        onHeightDelta?.(newH - oldH);
    }
    return true;
}
/** Apply every **`annotate-line`** in **`results`** (ignores other kinds). @returns count of successful patches */
function applyDbAnnotateLineResultsToLineItems(lines, results, onHeightDelta) {
    let n = 0;
    for (const r of results) {
        if (applyDbAnnotateLineResultToLineItems(lines, r, onHeightDelta)) {
            n++;
        }
    }
    return n;
}
//# sourceMappingURL=db-detector-framework.js.map