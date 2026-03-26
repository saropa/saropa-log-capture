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
const db_session_fingerprint_diff_1 = require("../../../modules/db/db-session-fingerprint-diff");
(0, node_test_1.default)("elapsedMsFromSaropaRawLine: parses [time] [+Nms] [category] body", () => {
    assert.strictEqual((0, db_session_fingerprint_diff_1.elapsedMsFromSaropaRawLine)("[12:00:00.000] [+5ms] [database] Drift: Sent SELECT 1"), 5);
    assert.strictEqual((0, db_session_fingerprint_diff_1.elapsedMsFromSaropaRawLine)("[+2s] [database] Drift: Sent SELECT 1"), 2000);
    assert.strictEqual((0, db_session_fingerprint_diff_1.elapsedMsFromSaropaRawLine)("plain"), undefined);
});
(0, node_test_1.default)("saropaLogBodyLineStartIndex: skips header before === divider", () => {
    const lines = ["=== SAROPA LOG CAPTURE", "k: v", "==========", "", "body"];
    const idx = (0, db_session_fingerprint_diff_1.saropaLogBodyLineStartIndex)(lines);
    assert.strictEqual(idx, 4);
    assert.strictEqual((0, db_session_fingerprint_diff_1.saropaLogBodyLineStartIndex)(["no divider", "x"]), 0);
});
(0, node_test_1.default)("buildDbFingerprintSummaryFromSaropaLogFileContent: counts Drift Sent lines", () => {
    const log = [
        "==========",
        "",
        "[12:00:00] [database] Drift: Sent SELECT 1 with args []",
        "[12:00:01] [+10ms] [database] Drift: Sent SELECT 1 with args [1]",
        "[12:00:02] [database] Drift: Sent SELECT 2 with args []",
    ].join("\n");
    const map = (0, db_session_fingerprint_diff_1.buildDbFingerprintSummaryFromSaropaLogFileContent)(log);
    // SELECT 1 / SELECT 2 normalize to the same fingerprint shape (literals → ?).
    assert.ok(map.size >= 1);
    let sum = 0;
    for (const e of map.values()) {
        sum += e.count;
    }
    assert.strictEqual(sum, 3);
    const withAvg = [...map.values()].filter((e) => e.avgDurationMs !== undefined);
    assert.ok(withAvg.length >= 1);
});
(0, node_test_1.default)("compareSaropaLogDatabaseFingerprints: new and removed fingerprints", () => {
    const lineA = "[12:00:00] [database] Drift: Sent SELECT a with args []";
    const lineB = "[12:00:00] [database] Drift: Sent SELECT b with args []";
    const a = `==========\n\n${lineA}\n${lineA}\n`;
    const b = `==========\n\n${lineB}\n`;
    const r = (0, db_session_fingerprint_diff_1.compareSaropaLogDatabaseFingerprints)(a, b);
    assert.ok(r.hasDriftSql);
    const kinds = new Set(r.rows.map((x) => x.kind));
    assert.ok(kinds.has("new"));
    assert.ok(kinds.has("removed"));
});
(0, node_test_1.default)("scanSaropaLogDatabaseFingerprints: slowQueryCount uses elapsed bracket and threshold", () => {
    const log = [
        "==========",
        "",
        "[12:00:00] [+30ms] [database] Drift: Sent SELECT 1 with args []",
        "[12:00:01] [+80ms] [database] Drift: Sent SELECT 1 with args [1]",
    ].join("\n");
    const scan = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(log, { slowQueryMs: 50 });
    const e = [...scan.summary.values()][0];
    assert.ok(e);
    assert.strictEqual(e.slowQueryCount, 1);
});
(0, node_test_1.default)("compareScannedSaropaDbFingerprints: exposes hasSlowQueryStats and row slow deltas", () => {
    const hdr = "==========\n\n";
    const slowLog = `${hdr}[12:00:00.000] [+100ms] [database] Drift: Sent SELECT 1 with args []\n`;
    const plainLog = `${hdr}[12:00:00.000] [database] Drift: Sent SELECT 1 with args []\n`;
    const a = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(slowLog, { slowQueryMs: 50 });
    const b = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(plainLog, { slowQueryMs: 50 });
    const r = (0, db_session_fingerprint_diff_1.compareScannedSaropaDbFingerprints)(a, b);
    assert.strictEqual(r.hasSlowQueryStats, true);
    const row = r.rows.find((x) => x.slowA !== undefined || x.slowB !== undefined);
    assert.ok(row);
    assert.strictEqual(row.slowA, 1);
    assert.strictEqual(row.slowB, undefined);
});
(0, node_test_1.default)("compareScannedSaropaDbFingerprints: hasSlowQueryStats false when no line exceeds slow threshold (no false positives)", () => {
    const hdr = "==========\n\n";
    const underThreshold = `${hdr}[12:00:00.000] [+30ms] [database] Drift: Sent SELECT 1 with args []\n`;
    const a = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(underThreshold, { slowQueryMs: 50 });
    const b = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(underThreshold, { slowQueryMs: 50 });
    const r = (0, db_session_fingerprint_diff_1.compareScannedSaropaDbFingerprints)(a, b);
    assert.strictEqual(r.hasSlowQueryStats, false);
    assert.ok(!r.rows.some((x) => x.slowA !== undefined || x.slowB !== undefined));
});
(0, node_test_1.default)("compareScannedSaropaDbFingerprints: hasSlowQueryStats false without slowQueryMs option even if log has +Nms", () => {
    const hdr = "==========\n\n";
    const log = `${hdr}[12:00:00.000] [+500ms] [database] Drift: Sent SELECT 1 with args []\n`;
    const a = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(log);
    const b = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(log);
    const r = (0, db_session_fingerprint_diff_1.compareScannedSaropaDbFingerprints)(a, b);
    assert.strictEqual(r.hasSlowQueryStats, false);
});
(0, node_test_1.default)("rankSessionDbFingerprintChanges: sorts new high-count before trivial same", () => {
    const baseline = new Map([["x", { count: 1 }]]);
    const target = new Map([
        ["x", { count: 1 }],
        ["brand_new", { count: 99 }],
    ]);
    const rows = (0, db_session_fingerprint_diff_1.rankSessionDbFingerprintChanges)(baseline, target);
    assert.strictEqual(rows[0].kind, "new");
    assert.strictEqual(rows[0].fingerprint, "brand_new");
});
//# sourceMappingURL=db-session-fingerprint-diff.test.js.map