"use strict";
/**
 * ## Slow query burst detector (plan **DB_08**)
 *
 * ### Purpose
 * Detect clusters of **slow** database-tagged queries (using per-line **`durationMs`** from replay /
 * capture metadata) and emit a single **marker** result so the log viewer can insert a visual cue and
 * jump-scroll to the line that completed the burst threshold.
 *
 * ### Where this runs
 * - **TypeScript (`feedSlowQueryBurstDetector`)** — source of truth for behavior and **unit tests**.
 * - **Embedded webview** — the same algorithm is duplicated in
 *   `viewer-db-detector-framework-script.ts` (same pattern as N+1 / DB_02 embed sync). When changing
 *   thresholds or math, update **both** and run `drift-db-slow-burst-detector.test.ts` plus embed
 *   string tests in `viewer-n-plus-one-embed.test.ts`.
 *
 * ### Algorithm (per logical session)
 * 1. On each **feed** with finite **`timestampMs`**, drop hits older than **`burstWindowMs`** (FIFO
 *    deque by time). This runs **before** checking `durationMs`, so intervening DB lines that carry
 *    only SQL (no elapsed) still advance window hygiene when they invoke `runDbDetectors`.
 * 2. If **`durationMs`** is missing, not finite, or below **`slowQueryMs`**, return `[]` (no new hit).
 * 3. If **`anchorSeq`** is missing, return `[]` (viewer must know which line completed the burst).
 * 4. Append `{ ts, seq }` for this slow sample. If count is still below **`burstMinCount`**, return `[]`.
 * 5. If **cooldown** is enabled and **`now - lastEmitTs`** is still inside the cooldown window, return `[]` (anti-flood).
 * 6. Else set **`lastEmitTs = now`**, emit **`kind: 'marker'`** with **`stableKey`** tied to the
 *    oldest hit still in the window (idempotency across trim/replay).
 *
 * ### Edge cases
 * - **`emitDbLineDetectors`** is skipped when a line is not **`database`** or has neither parsed SQL
 *   nor elapsed; in that rare case, slow-burst state is **not** pruned until a later qualifying line.
 * - **Multi-session**: `sessionId` is reserved; embed currently passes `null` (single `"default"` bucket).
 *
 * ### Related
 * - Thresholds: `drift-db-slow-burst-thresholds.ts` · Framework types: `db-detector-types.ts` · Marker
 *   UI: `viewer-data-add-db-detectors.ts` (`applyDbMarkerResults`), `viewer-script.ts` (click → scroll).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLOW_QUERY_BURST_DETECTOR_ID = void 0;
exports.createSlowBurstStateMap = createSlowBurstStateMap;
exports.feedSlowQueryBurstDetector = feedSlowQueryBurstDetector;
exports.pruneSlowBurstStateAfterTrim = pruneSlowBurstStateAfterTrim;
exports.resetSlowBurstDetectorState = resetSlowBurstDetectorState;
exports.SLOW_QUERY_BURST_DETECTOR_ID = "db.slow-query-burst";
function createSlowBurstStateMap() {
    return new Map();
}
function sessionKey(sessionId) {
    return sessionId !== null && sessionId !== "" ? sessionId : "default";
}
function getOrCreateSession(map, sid) {
    let st = map.get(sid);
    if (!st) {
        st = { hits: [], lastEmitTs: 0 };
        map.set(sid, st);
    }
    return st;
}
/**
 * Feed one database ingest event: prune expired hits, optionally append a slow sample, maybe emit a marker.
 */
function feedSlowQueryBurstDetector(ctx, map, t) {
    const now = ctx.timestampMs;
    if (typeof now !== "number" || !Number.isFinite(now)) {
        return [];
    }
    const sid = sessionKey(ctx.sessionId);
    const st = getOrCreateSession(map, sid);
    while (st.hits.length > 0 && st.hits[0].ts < now - t.burstWindowMs) {
        st.hits.shift();
    }
    const dur = ctx.durationMs;
    if (typeof dur !== "number" || !Number.isFinite(dur)) {
        return [];
    }
    if (dur < t.slowQueryMs) {
        return [];
    }
    const anc = ctx.anchorSeq;
    if (typeof anc !== "number" || !Number.isFinite(anc)) {
        return [];
    }
    st.hits.push({ ts: now, seq: anc });
    if (st.hits.length < t.burstMinCount) {
        return [];
    }
    if (t.cooldownMs > 0 && st.lastEmitTs > 0 && now - st.lastEmitTs < t.cooldownMs) {
        return [];
    }
    const windowStartMs = st.hits[0].ts;
    st.lastEmitTs = now;
    return [
        {
            kind: "marker",
            detectorId: exports.SLOW_QUERY_BURST_DETECTOR_ID,
            stableKey: `${exports.SLOW_QUERY_BURST_DETECTOR_ID}::${sid}::${windowStartMs}`,
            priority: 85,
            payload: {
                category: "db-signal",
                label: "Slow query burst",
                anchorSeq: anc,
            },
        },
    ];
}
/** After head trim: drop hits older than the oldest retained line timestamp. */
function pruneSlowBurstStateAfterTrim(map, oldestKeptTimestampMs) {
    if (typeof oldestKeptTimestampMs !== "number" || !Number.isFinite(oldestKeptTimestampMs)) {
        return;
    }
    for (const st of map.values()) {
        while (st.hits.length > 0 && st.hits[0].ts < oldestKeptTimestampMs) {
            st.hits.shift();
        }
    }
}
function resetSlowBurstDetectorState(map) {
    map.clear();
}
//# sourceMappingURL=drift-db-slow-burst-detector.js.map