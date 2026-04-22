"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const node_test_1 = __importDefault(require("node:test"));
const db_detector_framework_1 = require("../../../modules/db/db-detector-framework");
const drift_db_baseline_volume_compare_detector_1 = require("../../../modules/db/drift-db-baseline-volume-compare-detector");
const baseCtx = {
    timestampMs: 1000,
    sessionId: null,
    sourceTag: "database",
    level: "info",
    plainText: "",
    durationMs: undefined,
    sql: { fingerprint: "fp1", argsKey: "[]" },
};
(0, node_test_1.default)("runDbDetectorsIngest: stable priority order; lower cannot preempt higher for same key", () => {
    const first = {
        id: "low",
        priority: 0,
        feed: () => [
            {
                kind: "synthetic-line",
                detectorId: "low",
                stableKey: "x",
                priority: 0,
                payload: {},
            },
        ],
    };
    const second = {
        id: "high",
        priority: 100,
        feed: () => [
            {
                kind: "synthetic-line",
                detectorId: "high",
                stableKey: "x",
                priority: 100,
                payload: {},
            },
        ],
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const out = (0, db_detector_framework_1.runDbDetectorsIngest)([second, first], baseCtx, state);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].detectorId, "high");
});
(0, node_test_1.default)("runDbDetectorsIngest: throwing detector is disabled for the session", () => {
    let calls = 0;
    const bad = {
        id: "throws",
        priority: 0,
        feed: () => {
            calls++;
            throw new Error("boom");
        },
    };
    const good = {
        id: "ok",
        priority: 10,
        feed: () => [
            {
                kind: "synthetic-line",
                detectorId: "ok",
                stableKey: "only",
                priority: 10,
                payload: {},
            },
        ],
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    (0, db_detector_framework_1.runDbDetectorsIngest)([bad, good], baseCtx, state);
    assert.strictEqual(calls, 1);
    assert.ok(state.disabledDetectorIds.has("throws"));
    (0, db_detector_framework_1.runDbDetectorsIngest)([bad, good], baseCtx, state);
    assert.strictEqual(calls, 1);
});
(0, node_test_1.default)("runDbDetectorsCompare: runs compare hooks and merges stableKey by priority", () => {
    const baseline = new Map([["fp", { count: 1 }]]);
    const target = new Map([["fp", { count: 5 }]]);
    const low = {
        id: "c-low",
        priority: 0,
        feed: () => [],
        compare: ({ diff }) => {
            const row = diff.find((d) => d.fingerprint === "fp");
            if (!row?.baseline || !row.target) {
                return [];
            }
            return [
                {
                    kind: "synthetic-line",
                    detectorId: "c-low",
                    stableKey: "cmp::fp",
                    priority: 0,
                    payload: { delta: row.target.count - row.baseline.count },
                },
            ];
        },
    };
    const high = {
        id: "c-high",
        priority: 100,
        feed: () => [],
        compare: () => [
            {
                kind: "synthetic-line",
                detectorId: "c-high",
                stableKey: "cmp::fp",
                priority: 100,
                payload: { wins: true },
            },
        ],
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const out = (0, db_detector_framework_1.runDbDetectorsCompare)([high, low], { baseline, target }, state);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].detectorId, "c-high");
});
(0, node_test_1.default)("runDbDetectorsCompare: signalsEnabled false returns empty", () => {
    const d = {
        id: "x",
        priority: 0,
        feed: () => [],
        compare: () => [
            {
                kind: "synthetic-line",
                detectorId: "x",
                stableKey: "k",
                priority: 0,
                payload: {},
            },
        ],
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const out = (0, db_detector_framework_1.runDbDetectorsCompare)([d], { baseline: new Map(), target: new Map() }, state, {
        signalsEnabled: false,
    });
    assert.deepStrictEqual(out, []);
});
(0, node_test_1.default)("runDbDetectorsCompare: throwing compare disables detector", () => {
    const bad = {
        id: "bad-compare",
        priority: 0,
        feed: () => [],
        compare: () => {
            throw new Error("compare boom");
        },
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    (0, db_detector_framework_1.runDbDetectorsCompare)([bad], { baseline: new Map(), target: new Map() }, state);
    assert.ok(state.disabledDetectorIds.has("bad-compare"));
});
(0, node_test_1.default)("createBaselineVolumeCompareDetector: marker when target exceeds baseline enough", () => {
    const baseline = new Map([["fp1", { count: 10 }]]);
    const target = new Map([["fp1", { count: 20 }]]);
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const out = (0, db_detector_framework_1.runDbDetectorsCompare)([(0, drift_db_baseline_volume_compare_detector_1.createBaselineVolumeCompareDetector)()], { baseline, target }, state);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].kind, "marker");
});
(0, node_test_1.default)("createBaselineVolumeCompareDetector: no marker when increase is trivial", () => {
    const baseline = new Map([["fp1", { count: 2 }]]);
    const target = new Map([["fp1", { count: 3 }]]);
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const out = (0, db_detector_framework_1.runDbDetectorsCompare)([(0, drift_db_baseline_volume_compare_detector_1.createBaselineVolumeCompareDetector)()], { baseline, target }, state);
    assert.strictEqual(out.length, 0);
});
(0, node_test_1.default)("applyDbAnnotateLineResultToLineItems: shallow merge by seq", () => {
    const lines = [{ seq: 1, height: 20, level: "info" }];
    const ok = (0, db_detector_framework_1.applyDbAnnotateLineResultToLineItems)(lines, {
        kind: "annotate-line",
        detectorId: "t",
        stableKey: "t",
        priority: 1,
        payload: { targetSeq: 1, patch: { level: "error", tagged: true } },
    });
    assert.strictEqual(ok, true);
    assert.strictEqual(lines[0].level, "error");
    assert.strictEqual(lines[0].tagged, true);
});
(0, node_test_1.default)("applyDbAnnotateLineResultToLineItems: missing seq is false and leaves rows unchanged", () => {
    const lines = [{ seq: 1, height: 20 }];
    const snap = JSON.stringify(lines);
    const ok = (0, db_detector_framework_1.applyDbAnnotateLineResultToLineItems)(lines, {
        kind: "annotate-line",
        detectorId: "t",
        stableKey: "t",
        priority: 1,
        payload: { targetSeq: 999, patch: { x: 1 } },
    });
    assert.strictEqual(ok, false);
    assert.strictEqual(JSON.stringify(lines), snap);
});
(0, node_test_1.default)("applyDbAnnotateLineResultToLineItems: height delta invokes callback", () => {
    const lines = [{ seq: 2, height: 20 }];
    let d = 0;
    (0, db_detector_framework_1.applyDbAnnotateLineResultToLineItems)(lines, {
        kind: "annotate-line",
        detectorId: "t",
        stableKey: "t",
        priority: 1,
        payload: { targetSeq: 2, patch: { height: 5 } },
    }, (delta) => {
        d += delta;
    });
    assert.strictEqual(lines[0].height, 5);
    assert.strictEqual(d, -15);
});
(0, node_test_1.default)("applyDbAnnotateLineResultsToLineItems: skips non-annotate kinds", () => {
    const lines = [{ seq: 1, height: 10 }];
    const n = (0, db_detector_framework_1.applyDbAnnotateLineResultsToLineItems)(lines, [
        {
            kind: "marker",
            detectorId: "m",
            stableKey: "m",
            priority: 0,
            payload: {},
        },
        {
            kind: "annotate-line",
            detectorId: "a",
            stableKey: "a",
            priority: 1,
            payload: { targetSeq: 1, patch: { height: 0 } },
        },
    ]);
    assert.strictEqual(n, 1);
    assert.strictEqual(lines[0].height, 0);
});
(0, node_test_1.default)("runDbDetectorsCompare: optional annotateTargetLines applies annotate-line from merged results", () => {
    const lines = [{ seq: 1, height: 20 }];
    const ann = {
        id: "ann-compare",
        priority: 0,
        feed: () => [],
        compare: () => [
            {
                kind: "annotate-line",
                detectorId: "ann-compare",
                stableKey: "ann::1",
                priority: 1,
                payload: { targetSeq: 1, patch: { height: 0 } },
            },
        ],
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    let deltaSum = 0;
    (0, db_detector_framework_1.runDbDetectorsCompare)([ann], { baseline: new Map(), target: new Map() }, state, {
        annotateTargetLines: lines,
        onAnnotateHeightDelta: (d) => {
            deltaSum += d;
        },
    });
    assert.strictEqual(lines[0].height, 0);
    assert.strictEqual(deltaSum, -20);
});
(0, node_test_1.default)("runDefaultSessionDbCompareDetectors: same marker count as manual registry for volume regression", () => {
    const baseline = new Map([["fp1", { count: 10 }]]);
    const target = new Map([["fp1", { count: 20 }]]);
    const stateA = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const stateB = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const a = (0, db_detector_framework_1.runDefaultSessionDbCompareDetectors)({ baseline, target }, stateA);
    const b = (0, db_detector_framework_1.runDbDetectorsCompare)([(0, drift_db_baseline_volume_compare_detector_1.createBaselineVolumeCompareDetector)()], { baseline, target }, stateB);
    assert.strictEqual(a.length, b.length);
    assert.strictEqual(a[0]?.detectorId, b[0]?.detectorId);
});
(0, node_test_1.default)("runDbDetectorsIngest: signalsEnabled false returns empty", () => {
    const d = {
        id: "x",
        priority: 0,
        feed: () => [
            {
                kind: "synthetic-line",
                detectorId: "x",
                stableKey: "k",
                priority: 0,
                payload: {},
            },
        ],
    };
    const state = (0, db_detector_framework_1.createDbDetectorSessionState)();
    const out = (0, db_detector_framework_1.runDbDetectorsIngest)([d], baseCtx, state, { signalsEnabled: false });
    assert.deepStrictEqual(out, []);
});
//# sourceMappingURL=db-detector-framework.test.js.map