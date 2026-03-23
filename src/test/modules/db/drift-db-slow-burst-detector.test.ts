import * as assert from "node:assert";
import test from "node:test";
import {
  createSlowBurstStateMap,
  feedSlowQueryBurstDetector,
  pruneSlowBurstStateAfterTrim,
  resetSlowBurstDetectorState,
  SLOW_QUERY_BURST_DETECTOR_ID,
} from "../../../modules/db/drift-db-slow-burst-detector";
import type { ViewerSlowBurstThresholds } from "../../../modules/db/drift-db-slow-burst-thresholds";

const t: ViewerSlowBurstThresholds = {
  slowQueryMs: 50,
  burstMinCount: 5,
  burstWindowMs: 2000,
  cooldownMs: 10_000,
};

test("feedSlowQueryBurstDetector: no duration yields no marker", () => {
  const map = createSlowBurstStateMap();
  const out = feedSlowQueryBurstDetector(
    {
      timestampMs: 1000,
      sessionId: null,
      durationMs: undefined,
      anchorSeq: 1,
    },
    map,
    t,
  );
  assert.deepStrictEqual(out, []);
});

test("feedSlowQueryBurstDetector: fast query does not add hit", () => {
  const map = createSlowBurstStateMap();
  assert.deepStrictEqual(
    feedSlowQueryBurstDetector(
      { timestampMs: 1000, sessionId: null, durationMs: 10, anchorSeq: 1 },
      map,
      t,
    ),
    [],
  );
});

test("feedSlowQueryBurstDetector: five borderline-fast queries never fire (false positive guard)", () => {
  const map = createSlowBurstStateMap();
  for (let i = 0; i < 5; i++) {
    assert.deepStrictEqual(
      feedSlowQueryBurstDetector(
        { timestampMs: 100 + i * 10, sessionId: null, durationMs: 49, anchorSeq: i + 1 },
        map,
        t,
      ),
      [],
    );
  }
  assert.strictEqual(map.get("default")?.hits.length ?? 0, 0);
});

test("feedSlowQueryBurstDetector: slow duration without anchorSeq does not add hit", () => {
  const map = createSlowBurstStateMap();
  assert.deepStrictEqual(
    feedSlowQueryBurstDetector(
      { timestampMs: 1000, sessionId: null, durationMs: 60, anchorSeq: undefined },
      map,
      t,
    ),
    [],
  );
  assert.strictEqual(map.get("default")?.hits.length ?? 0, 0);
});

test("feedSlowQueryBurstDetector: four slow then fast spam; fifth slow after window ages out stays sub-threshold", () => {
  const map = createSlowBurstStateMap();
  for (let i = 0; i < 4; i++) {
    feedSlowQueryBurstDetector(
      { timestampMs: 1000 + i * 100, sessionId: null, durationMs: 60, anchorSeq: i + 1 },
      map,
      t,
    );
  }
  for (let j = 0; j < 10; j++) {
    assert.deepStrictEqual(
      feedSlowQueryBurstDetector(
        { timestampMs: 2000 + j * 50, sessionId: null, durationMs: 5, anchorSeq: 100 + j },
        map,
        t,
      ),
      [],
    );
  }
  assert.deepStrictEqual(
    feedSlowQueryBurstDetector(
      { timestampMs: 4000, sessionId: null, durationMs: 60, anchorSeq: 999 },
      map,
      t,
    ),
    [],
  );
  assert.strictEqual(map.get("default")?.hits.length, 1);
});

test("feedSlowQueryBurstDetector: prune runs on feed without duration after slow hits", () => {
  const map = createSlowBurstStateMap();
  for (let i = 0; i < 4; i++) {
    feedSlowQueryBurstDetector(
      { timestampMs: 1000 + i * 100, sessionId: null, durationMs: 60, anchorSeq: i + 1 },
      map,
      t,
    );
  }
  assert.deepStrictEqual(
    feedSlowQueryBurstDetector(
      { timestampMs: 10_000, sessionId: null, durationMs: undefined, anchorSeq: 1 },
      map,
      t,
    ),
    [],
  );
  assert.strictEqual(map.get("default")?.hits.length ?? 0, 0);
});

test("feedSlowQueryBurstDetector: fifth slow query in window emits one marker", () => {
  const map = createSlowBurstStateMap();
  const sid = "default";
  for (let i = 0; i < 4; i++) {
    assert.deepStrictEqual(
      feedSlowQueryBurstDetector(
        { timestampMs: 100 + i * 100, sessionId: null, durationMs: 60, anchorSeq: i + 1 },
        map,
        t,
      ),
      [],
    );
  }
  const fifth = feedSlowQueryBurstDetector(
    { timestampMs: 500, sessionId: null, durationMs: 55, anchorSeq: 99 },
    map,
    t,
  );
  assert.strictEqual(fifth.length, 1);
  assert.strictEqual(fifth[0].kind, "marker");
  assert.strictEqual(fifth[0].detectorId, SLOW_QUERY_BURST_DETECTOR_ID);
  assert.strictEqual(fifth[0].stableKey, `${SLOW_QUERY_BURST_DETECTOR_ID}::${sid}::100`);
  assert.strictEqual((fifth[0].payload as { anchorSeq: number }).anchorSeq, 99);
});

test("feedSlowQueryBurstDetector: sustained burst respects cooldown", () => {
  const map = createSlowBurstStateMap();
  const t0 = 1000;
  for (let i = 0; i < 5; i++) {
    feedSlowQueryBurstDetector(
      { timestampMs: t0 + i * 50, sessionId: null, durationMs: 60, anchorSeq: i + 1 },
      map,
      t,
    );
  }
  const lastEmitTs = t0 + 4 * 50;
  const flood = feedSlowQueryBurstDetector(
    { timestampMs: lastEmitTs + 30, sessionId: null, durationMs: 60, anchorSeq: 200 },
    map,
    t,
  );
  assert.deepStrictEqual(flood, []);
  const afterCooldownMs = lastEmitTs + t.cooldownMs;
  let secondBurst = feedSlowQueryBurstDetector(
    { timestampMs: afterCooldownMs, sessionId: null, durationMs: 60, anchorSeq: 300 },
    map,
    t,
  );
  assert.strictEqual(secondBurst.length, 0);
  for (let j = 1; j < 5; j++) {
    secondBurst = feedSlowQueryBurstDetector(
      { timestampMs: afterCooldownMs + j * 40, sessionId: null, durationMs: 60, anchorSeq: 400 + j },
      map,
      t,
    );
  }
  assert.strictEqual(secondBurst.length, 1);
});

test("pruneSlowBurstStateAfterTrim drops old hits", () => {
  const map = createSlowBurstStateMap();
  feedSlowQueryBurstDetector(
    { timestampMs: 1000, sessionId: null, durationMs: 60, anchorSeq: 1 },
    map,
    t,
  );
  pruneSlowBurstStateAfterTrim(map, 1500);
  const again = feedSlowQueryBurstDetector(
    { timestampMs: 3200, sessionId: null, durationMs: 60, anchorSeq: 2 },
    map,
    t,
  );
  assert.deepStrictEqual(again, []);
  assert.strictEqual(map.get("default")?.hits.length, 1);
});

test("resetSlowBurstDetectorState clears map", () => {
  const map = createSlowBurstStateMap();
  feedSlowQueryBurstDetector(
    { timestampMs: 100, sessionId: null, durationMs: 60, anchorSeq: 1 },
    map,
    t,
  );
  resetSlowBurstDetectorState(map);
  assert.strictEqual(map.size, 0);
});
