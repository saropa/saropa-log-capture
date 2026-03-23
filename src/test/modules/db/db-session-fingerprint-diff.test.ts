import * as assert from "node:assert";
import test from "node:test";
import {
  buildDbFingerprintSummaryFromSaropaLogFileContent,
  compareSaropaLogDatabaseFingerprints,
  compareScannedSaropaDbFingerprints,
  elapsedMsFromSaropaRawLine,
  rankSessionDbFingerprintChanges,
  saropaLogBodyLineStartIndex,
  scanSaropaLogDatabaseFingerprints,
} from "../../../modules/db/db-session-fingerprint-diff";

test("elapsedMsFromSaropaRawLine: parses [time] [+Nms] [category] body", () => {
  assert.strictEqual(
    elapsedMsFromSaropaRawLine("[12:00:00.000] [+5ms] [database] Drift: Sent SELECT 1"),
    5,
  );
  assert.strictEqual(
    elapsedMsFromSaropaRawLine("[+2s] [database] Drift: Sent SELECT 1"),
    2000,
  );
  assert.strictEqual(elapsedMsFromSaropaRawLine("plain"), undefined);
});

test("saropaLogBodyLineStartIndex: skips header before === divider", () => {
  const lines = ["=== SAROPA LOG CAPTURE", "k: v", "==========", "", "body"];
  const idx = saropaLogBodyLineStartIndex(lines);
  assert.strictEqual(idx, 4);
  assert.strictEqual(saropaLogBodyLineStartIndex(["no divider", "x"]), 0);
});

test("buildDbFingerprintSummaryFromSaropaLogFileContent: counts Drift Sent lines", () => {
  const log = [
    "==========",
    "",
    "[12:00:00] [database] Drift: Sent SELECT 1 with args []",
    "[12:00:01] [+10ms] [database] Drift: Sent SELECT 1 with args [1]",
    "[12:00:02] [database] Drift: Sent SELECT 2 with args []",
  ].join("\n");
  const map = buildDbFingerprintSummaryFromSaropaLogFileContent(log);
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

test("compareSaropaLogDatabaseFingerprints: new and removed fingerprints", () => {
  const lineA = "[12:00:00] [database] Drift: Sent SELECT a with args []";
  const lineB = "[12:00:00] [database] Drift: Sent SELECT b with args []";
  const a = `==========\n\n${lineA}\n${lineA}\n`;
  const b = `==========\n\n${lineB}\n`;
  const r = compareSaropaLogDatabaseFingerprints(a, b);
  assert.ok(r.hasDriftSql);
  const kinds = new Set(r.rows.map((x) => x.kind));
  assert.ok(kinds.has("new"));
  assert.ok(kinds.has("removed"));
});

test("scanSaropaLogDatabaseFingerprints: slowQueryCount uses elapsed bracket and threshold", () => {
  const log = [
    "==========",
    "",
    "[12:00:00] [+30ms] [database] Drift: Sent SELECT 1 with args []",
    "[12:00:01] [+80ms] [database] Drift: Sent SELECT 1 with args [1]",
  ].join("\n");
  const scan = scanSaropaLogDatabaseFingerprints(log, { slowQueryMs: 50 });
  const e = [...scan.summary.values()][0];
  assert.ok(e);
  assert.strictEqual(e.slowQueryCount, 1);
});

test("compareScannedSaropaDbFingerprints: exposes hasSlowQueryStats and row slow deltas", () => {
  const hdr = "==========\n\n";
  const slowLog = `${hdr}[12:00:00.000] [+100ms] [database] Drift: Sent SELECT 1 with args []\n`;
  const plainLog = `${hdr}[12:00:00.000] [database] Drift: Sent SELECT 1 with args []\n`;
  const a = scanSaropaLogDatabaseFingerprints(slowLog, { slowQueryMs: 50 });
  const b = scanSaropaLogDatabaseFingerprints(plainLog, { slowQueryMs: 50 });
  const r = compareScannedSaropaDbFingerprints(a, b);
  assert.strictEqual(r.hasSlowQueryStats, true);
  const row = r.rows.find((x) => x.slowA !== undefined || x.slowB !== undefined);
  assert.ok(row);
  assert.strictEqual(row!.slowA, 1);
  assert.strictEqual(row!.slowB, undefined);
});

test("compareScannedSaropaDbFingerprints: hasSlowQueryStats false when no line exceeds slow threshold (no false positives)", () => {
  const hdr = "==========\n\n";
  const underThreshold = `${hdr}[12:00:00.000] [+30ms] [database] Drift: Sent SELECT 1 with args []\n`;
  const a = scanSaropaLogDatabaseFingerprints(underThreshold, { slowQueryMs: 50 });
  const b = scanSaropaLogDatabaseFingerprints(underThreshold, { slowQueryMs: 50 });
  const r = compareScannedSaropaDbFingerprints(a, b);
  assert.strictEqual(r.hasSlowQueryStats, false);
  assert.ok(!r.rows.some((x) => x.slowA !== undefined || x.slowB !== undefined));
});

test("compareScannedSaropaDbFingerprints: hasSlowQueryStats false without slowQueryMs option even if log has +Nms", () => {
  const hdr = "==========\n\n";
  const log = `${hdr}[12:00:00.000] [+500ms] [database] Drift: Sent SELECT 1 with args []\n`;
  const a = scanSaropaLogDatabaseFingerprints(log);
  const b = scanSaropaLogDatabaseFingerprints(log);
  const r = compareScannedSaropaDbFingerprints(a, b);
  assert.strictEqual(r.hasSlowQueryStats, false);
});

test("rankSessionDbFingerprintChanges: sorts new high-count before trivial same", () => {
  const baseline = new Map([["x", { count: 1 }]]);
  const target = new Map([
    ["x", { count: 1 }],
    ["brand_new", { count: 99 }],
  ]);
  const rows = rankSessionDbFingerprintChanges(baseline, target);
  assert.strictEqual(rows[0].kind, "new");
  assert.strictEqual(rows[0].fingerprint, "brand_new");
});
