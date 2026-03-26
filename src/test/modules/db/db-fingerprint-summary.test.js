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
const db_fingerprint_summary_1 = require("../../../modules/db/db-fingerprint-summary");
function ctx(over) {
    return {
        timestampMs: 1,
        sessionId: null,
        sourceTag: "database",
        level: "info",
        plainText: "",
        durationMs: undefined,
        ...over,
    };
}
(0, node_test_1.default)("buildDbFingerprintSummaryFromDetectorContexts: counts SQL rows and durations", () => {
    const fp = "select ? from t";
    const map = (0, db_fingerprint_summary_1.buildDbFingerprintSummaryFromDetectorContexts)([
        ctx({ sql: { fingerprint: fp, argsKey: "[]" }, durationMs: 10 }),
        ctx({ sql: { fingerprint: fp, argsKey: "[1]" }, durationMs: 30 }),
        ctx({ sql: null }),
    ]);
    const e = map.get(fp);
    assert.ok(e);
    assert.strictEqual(e.count, 2);
    assert.strictEqual(e.durationSampleCount, 2);
    assert.strictEqual(e.avgDurationMs, 20);
    assert.strictEqual(e.maxDurationMs, 30);
});
(0, node_test_1.default)("mergeDbFingerprintSummaryEntries: weighted average and max", () => {
    const a = { count: 2, avgDurationMs: 10, maxDurationMs: 10, durationSampleCount: 2 };
    const b = { count: 1, avgDurationMs: 40, maxDurationMs: 40, durationSampleCount: 1 };
    const m = (0, db_fingerprint_summary_1.mergeDbFingerprintSummaryEntries)(a, b);
    assert.strictEqual(m.count, 3);
    assert.strictEqual(m.durationSampleCount, 3);
    assert.strictEqual(m.avgDurationMs, 20);
    assert.strictEqual(m.maxDurationMs, 40);
});
(0, node_test_1.default)("mergeDbFingerprintSummaryMaps: combines keys", () => {
    const a = new Map([["x", { count: 1 }]]);
    const b = new Map([["y", { count: 2 }]]);
    const m = (0, db_fingerprint_summary_1.mergeDbFingerprintSummaryMaps)(a, b);
    assert.strictEqual(m.size, 2);
    assert.strictEqual(m.get("x").count, 1);
    assert.strictEqual(m.get("y").count, 2);
});
(0, node_test_1.default)("buildDbFingerprintSummaryFromDetectorContexts: slowQueryCount when threshold set", () => {
    const fp = "select ?";
    const map = (0, db_fingerprint_summary_1.buildDbFingerprintSummaryFromDetectorContexts)([
        ctx({ sql: { fingerprint: fp, argsKey: "[]" }, durationMs: 10 }),
        ctx({ sql: { fingerprint: fp, argsKey: "[]" }, durationMs: 99 }),
    ], { slowQueryMsThreshold: 50 });
    const e = map.get(fp);
    assert.ok(e);
    assert.strictEqual(e.count, 2);
    assert.strictEqual(e.slowQueryCount, 1);
});
(0, node_test_1.default)("mergeDbFingerprintSummaryEntries: sums slowQueryCount", () => {
    const m = (0, db_fingerprint_summary_1.mergeDbFingerprintSummaryEntries)({ count: 1, slowQueryCount: 2 }, { count: 1, slowQueryCount: 3 });
    assert.strictEqual(m.count, 2);
    assert.strictEqual(m.slowQueryCount, 5);
});
(0, node_test_1.default)("buildDbFingerprintSummaryDiff: sorted union", () => {
    const baseline = new Map([
        ["b", { count: 1 }],
        ["a", { count: 2 }],
    ]);
    const target = new Map([["c", { count: 3 }]]);
    const diff = (0, db_fingerprint_summary_1.buildDbFingerprintSummaryDiff)(baseline, target);
    assert.deepStrictEqual(diff.map((r) => r.fingerprint), ["a", "b", "c"]);
    assert.deepStrictEqual(diff[0], { fingerprint: "a", baseline: { count: 2 }, target: undefined });
    assert.deepStrictEqual(diff[2], { fingerprint: "c", baseline: undefined, target: { count: 3 } });
});
//# sourceMappingURL=db-fingerprint-summary.test.js.map