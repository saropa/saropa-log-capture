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
const drift_db_slow_burst_detector_1 = require("../../../modules/db/drift-db-slow-burst-detector");
const t = {
    slowQueryMs: 50,
    burstMinCount: 5,
    burstWindowMs: 2000,
    cooldownMs: 10_000,
};
(0, node_test_1.default)("feedSlowQueryBurstDetector: no duration yields no marker", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    const out = (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({
        timestampMs: 1000,
        sessionId: null,
        durationMs: undefined,
        anchorSeq: 1,
    }, map, t);
    assert.deepStrictEqual(out, []);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: fast query does not add hit", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 1000, sessionId: null, durationMs: 10, anchorSeq: 1 }, map, t), []);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: five borderline-fast queries never fire (false positive guard)", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    for (let i = 0; i < 5; i++) {
        assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 100 + i * 10, sessionId: null, durationMs: 49, anchorSeq: i + 1 }, map, t), []);
    }
    assert.strictEqual(map.get("default")?.hits.length ?? 0, 0);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: slow duration without anchorSeq does not add hit", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 1000, sessionId: null, durationMs: 60, anchorSeq: undefined }, map, t), []);
    assert.strictEqual(map.get("default")?.hits.length ?? 0, 0);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: four slow then fast spam; fifth slow after window ages out stays sub-threshold", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    for (let i = 0; i < 4; i++) {
        (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 1000 + i * 100, sessionId: null, durationMs: 60, anchorSeq: i + 1 }, map, t);
    }
    for (let j = 0; j < 10; j++) {
        assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 2000 + j * 50, sessionId: null, durationMs: 5, anchorSeq: 100 + j }, map, t), []);
    }
    assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 4000, sessionId: null, durationMs: 60, anchorSeq: 999 }, map, t), []);
    assert.strictEqual(map.get("default")?.hits.length, 1);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: prune runs on feed without duration after slow hits", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    for (let i = 0; i < 4; i++) {
        (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 1000 + i * 100, sessionId: null, durationMs: 60, anchorSeq: i + 1 }, map, t);
    }
    assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 10_000, sessionId: null, durationMs: undefined, anchorSeq: 1 }, map, t), []);
    assert.strictEqual(map.get("default")?.hits.length ?? 0, 0);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: fifth slow query in window emits one marker", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    const sid = "default";
    for (let i = 0; i < 4; i++) {
        assert.deepStrictEqual((0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 100 + i * 100, sessionId: null, durationMs: 60, anchorSeq: i + 1 }, map, t), []);
    }
    const fifth = (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 500, sessionId: null, durationMs: 55, anchorSeq: 99 }, map, t);
    assert.strictEqual(fifth.length, 1);
    assert.strictEqual(fifth[0].kind, "marker");
    assert.strictEqual(fifth[0].detectorId, drift_db_slow_burst_detector_1.SLOW_QUERY_BURST_DETECTOR_ID);
    assert.strictEqual(fifth[0].stableKey, `${drift_db_slow_burst_detector_1.SLOW_QUERY_BURST_DETECTOR_ID}::${sid}::100`);
    assert.strictEqual(fifth[0].payload.anchorSeq, 99);
});
(0, node_test_1.default)("feedSlowQueryBurstDetector: sustained burst respects cooldown", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    const t0 = 1000;
    for (let i = 0; i < 5; i++) {
        (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: t0 + i * 50, sessionId: null, durationMs: 60, anchorSeq: i + 1 }, map, t);
    }
    const lastEmitTs = t0 + 4 * 50;
    const flood = (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: lastEmitTs + 30, sessionId: null, durationMs: 60, anchorSeq: 200 }, map, t);
    assert.deepStrictEqual(flood, []);
    const afterCooldownMs = lastEmitTs + t.cooldownMs;
    let secondBurst = (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: afterCooldownMs, sessionId: null, durationMs: 60, anchorSeq: 300 }, map, t);
    assert.strictEqual(secondBurst.length, 0);
    for (let j = 1; j < 5; j++) {
        secondBurst = (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: afterCooldownMs + j * 40, sessionId: null, durationMs: 60, anchorSeq: 400 + j }, map, t);
    }
    assert.strictEqual(secondBurst.length, 1);
});
(0, node_test_1.default)("pruneSlowBurstStateAfterTrim drops old hits", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 1000, sessionId: null, durationMs: 60, anchorSeq: 1 }, map, t);
    (0, drift_db_slow_burst_detector_1.pruneSlowBurstStateAfterTrim)(map, 1500);
    const again = (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 3200, sessionId: null, durationMs: 60, anchorSeq: 2 }, map, t);
    assert.deepStrictEqual(again, []);
    assert.strictEqual(map.get("default")?.hits.length, 1);
});
(0, node_test_1.default)("resetSlowBurstDetectorState clears map", () => {
    const map = (0, drift_db_slow_burst_detector_1.createSlowBurstStateMap)();
    (0, drift_db_slow_burst_detector_1.feedSlowQueryBurstDetector)({ timestampMs: 100, sessionId: null, durationMs: 60, anchorSeq: 1 }, map, t);
    (0, drift_db_slow_burst_detector_1.resetSlowBurstDetectorState)(map);
    assert.strictEqual(map.size, 0);
});
//# sourceMappingURL=drift-db-slow-burst-detector.test.js.map