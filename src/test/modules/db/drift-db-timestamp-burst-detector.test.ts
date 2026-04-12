import * as assert from "node:assert";
import test from "node:test";
import {
  createTimestampBurstStateMap,
  feedTimestampBurstDetector,
  resetTimestampBurstDetectorState,
  TIMESTAMP_BURST_DETECTOR_ID,
} from "../../../modules/db/drift-db-timestamp-burst-detector";
import type { ViewerTimestampBurstThresholds } from "../../../modules/db/drift-db-timestamp-burst-thresholds";

const t: ViewerTimestampBurstThresholds = {
  minCount: 3,
  toleranceMs: 10,
  cooldownMs: 5000,
};

test("feedTimestampBurstDetector: single line yields no marker", () => {
  const map = createTimestampBurstStateMap();
  const out = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: 1 },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("feedTimestampBurstDetector: two lines at same ts below threshold", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  const out = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: 2 },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("feedTimestampBurstDetector: three lines at same ts emits marker", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 2 }, map, t);
  const out = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: 3 },
    map,
    t,
  );
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].detectorId, TIMESTAMP_BURST_DETECTOR_ID);
  assert.strictEqual(out[0].kind, "marker");
  assert.strictEqual(out[0].priority, 80);
});

test("feedTimestampBurstDetector: tolerance allows slight differences", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1005, sessionId: null, anchorSeq: 2 }, map, t);
  const out = feedTimestampBurstDetector(
    { timestampMs: 1010, sessionId: null, anchorSeq: 3 },
    map,
    t,
  );
  assert.strictEqual(out.length, 1);
});

test("feedTimestampBurstDetector: beyond tolerance starts new burst", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 2 }, map, t);
  // Jump beyond tolerance — resets burst
  feedTimestampBurstDetector({ timestampMs: 1020, sessionId: null, anchorSeq: 3 }, map, t);
  const out = feedTimestampBurstDetector(
    { timestampMs: 1020, sessionId: null, anchorSeq: 4 },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("feedTimestampBurstDetector: emits only once per burst", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 2 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 3 }, map, t);
  // Fourth line at same ts — should not emit again
  const out = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: 4 },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("feedTimestampBurstDetector: cooldown suppresses rapid bursts", () => {
  const map = createTimestampBurstStateMap();
  // First burst at ts 1000
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 2 }, map, t);
  const first = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: 3 },
    map,
    t,
  );
  assert.strictEqual(first.length, 1);

  // Second burst at ts 2000 (within cooldown of 5000ms)
  feedTimestampBurstDetector({ timestampMs: 2000, sessionId: null, anchorSeq: 10 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 2000, sessionId: null, anchorSeq: 11 }, map, t);
  const second = feedTimestampBurstDetector(
    { timestampMs: 2000, sessionId: null, anchorSeq: 12 },
    map,
    t,
  );
  assert.deepStrictEqual(second, []);
});

test("feedTimestampBurstDetector: emits after cooldown expires", () => {
  const map = createTimestampBurstStateMap();
  // First burst
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 2 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 3 }, map, t);

  // Second burst well after cooldown
  feedTimestampBurstDetector({ timestampMs: 7000, sessionId: null, anchorSeq: 10 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 7000, sessionId: null, anchorSeq: 11 }, map, t);
  const out = feedTimestampBurstDetector(
    { timestampMs: 7000, sessionId: null, anchorSeq: 12 },
    map,
    t,
  );
  assert.strictEqual(out.length, 1);
});

test("feedTimestampBurstDetector: invalid timestampMs returns empty", () => {
  const map = createTimestampBurstStateMap();
  const out = feedTimestampBurstDetector(
    { timestampMs: NaN, sessionId: null, anchorSeq: 1 },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("feedTimestampBurstDetector: missing anchorSeq returns empty", () => {
  const map = createTimestampBurstStateMap();
  const out = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: undefined },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("resetTimestampBurstDetectorState: clears all sessions", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 1 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: "s2", anchorSeq: 2 }, map, t);
  resetTimestampBurstDetectorState(map);
  assert.strictEqual(map.size, 0);
});

test("feedTimestampBurstDetector: stable key includes firstSeq", () => {
  const map = createTimestampBurstStateMap();
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 50 }, map, t);
  feedTimestampBurstDetector({ timestampMs: 1000, sessionId: null, anchorSeq: 51 }, map, t);
  const out = feedTimestampBurstDetector(
    { timestampMs: 1000, sessionId: null, anchorSeq: 52 },
    map,
    t,
  );
  assert.strictEqual(out[0].stableKey, `${TIMESTAMP_BURST_DETECTOR_ID}::default::50`);
});
