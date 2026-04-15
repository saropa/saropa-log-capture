/**
 * ## DB timestamp burst detector (plan **DB_16**)
 *
 * ### Purpose
 * Detect clusters of database queries at the same timestamp (within tolerance), which
 * indicates redundant or unnecessarily concurrent DB access — a common code smell in
 * async Dart apps where the same provider lookup fires multiple times per frame.
 *
 * ### Algorithm (per logical session)
 * 1. On each **feed** with finite `timestampMs`:
 *    - If within `toleranceMs` of the current burst's reference timestamp, increment count.
 *    - Otherwise, start a new burst (reset reference, count = 1).
 * 2. When count first reaches `minCount`, check cooldown; if clear, emit a **marker**.
 *
 * ### Related
 * - Thresholds: `drift-db-timestamp-burst-thresholds.ts`
 * - Framework: `db-detector-types.ts`, `viewer-db-detector-framework-script.ts`
 */

import type { DbDetectorResult } from "./db-detector-types";
import type { ViewerTimestampBurstThresholds } from "./drift-db-timestamp-burst-thresholds";

export const TIMESTAMP_BURST_DETECTOR_ID = "db.timestamp-burst";

/** Per-session mutable state for tracking the current burst. */
export interface TimestampBurstSessionState {
  /** Reference timestamp for the current burst window. */
  refTs: number;
  /** Count of DB lines within tolerance of refTs. */
  count: number;
  /** Seq of the first line in this burst (used for stable key). */
  firstSeq: number;
  /** Whether a marker was already emitted for this burst. */
  emitted: boolean;
  /** Last time a marker was emitted (for cooldown). */
  lastEmitTs: number;
}

export type TimestampBurstStateMap = Map<string, TimestampBurstSessionState>;

export function createTimestampBurstStateMap(): TimestampBurstStateMap {
  return new Map();
}

function sessionKey(sessionId: string | null): string {
  return sessionId !== null && sessionId !== "" ? sessionId : "default";
}

function getOrCreateSession(
  map: TimestampBurstStateMap,
  sid: string,
): TimestampBurstSessionState {
  let st = map.get(sid);
  if (!st) {
    st = { refTs: 0, count: 0, firstSeq: 0, emitted: false, lastEmitTs: 0 };
    map.set(sid, st);
  }
  return st;
}

/**
 * Feed one database ingest event. Returns a marker when a timestamp burst is detected.
 */
export function feedTimestampBurstDetector(
  ctx: {
    readonly timestampMs: number;
    readonly sessionId: string | null;
    readonly anchorSeq: number | undefined;
  },
  map: TimestampBurstStateMap,
  t: ViewerTimestampBurstThresholds,
): readonly DbDetectorResult[] {
  const now = ctx.timestampMs;
  if (typeof now !== "number" || !Number.isFinite(now)) {
    return [];
  }
  const anc = ctx.anchorSeq;
  if (typeof anc !== "number" || !Number.isFinite(anc)) {
    return [];
  }

  const sid = sessionKey(ctx.sessionId);
  const st = getOrCreateSession(map, sid);

  if (st.count > 0 && Math.abs(now - st.refTs) <= t.toleranceMs) {
    st.count++;
  } else {
    st.refTs = now;
    st.count = 1;
    st.firstSeq = anc;
    st.emitted = false;
  }

  if (st.count < t.minCount || st.emitted) {
    return [];
  }

  if (t.cooldownMs > 0 && st.lastEmitTs > 0 && now - st.lastEmitTs < t.cooldownMs) {
    return [];
  }

  st.emitted = true;
  st.lastEmitTs = now;

  return [
    {
      kind: "marker",
      detectorId: TIMESTAMP_BURST_DETECTOR_ID,
      stableKey: `${TIMESTAMP_BURST_DETECTOR_ID}::${sid}::${st.firstSeq}`,
      priority: 80,
      payload: {
        category: "db-signal",
        label: `DB timestamp burst (${st.count} queries at same instant)`,
        anchorSeq: anc,
      },
    },
  ];
}

/** Reset all session state (on log clear). */
export function resetTimestampBurstDetectorState(
  map: TimestampBurstStateMap,
): void {
  map.clear();
}
