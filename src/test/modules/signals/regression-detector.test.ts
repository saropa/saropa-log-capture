import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRegressionSignalEntries,
  detectRegressions,
} from "../../../modules/signals/regression-detector";
import type { FingerprintEntry } from "../../../modules/analysis/error-fingerprint";
import type { LoadedMeta } from "../../../modules/session/metadata-loader";
import type { SessionMeta } from "../../../modules/session/session-metadata";

function makeFp(h: string, e: string, c: number = 1): FingerprintEntry {
  return { h, e, n: e, c };
}

function makeMeta(filename: string, fingerprints: FingerprintEntry[]): LoadedMeta {
  const meta: SessionMeta = { fingerprints };
  return { filename, meta } as LoadedMeta;
}

// -------- F7 NEW ERROR TYPE --------

test("new error: fingerprint in current but absent from past surfaces as a new error", () => {
  const result = detectRegressions({
    currentFingerprints: [makeFp("abc123", "TypeError: Null check operator", 2)],
    pastMetas: [
      makeMeta("session-1.log", [makeFp("oldhash", "Some other error")]),
      makeMeta("session-2.log", [makeFp("oldhash", "Some other error")]),
    ],
  });
  assert.equal(result.newErrors.length, 1);
  assert.equal(result.newErrors[0].hash, "abc123");
  assert.match(result.newErrors[0].example, /TypeError/);
  assert.equal(result.disappearingErrors.length, 1);
  assert.equal(result.disappearingErrors[0].hash, "oldhash");
});

test("new error: fingerprint present in past is NOT flagged as new", () => {
  const result = detectRegressions({
    currentFingerprints: [makeFp("abc123", "Recurring error")],
    pastMetas: [
      makeMeta("session-1.log", [makeFp("abc123", "Recurring error")]),
    ],
  });
  assert.equal(result.newErrors.length, 0);
});

// -------- F8 DISAPPEARING ERROR --------

test("disappearing error: fingerprint in past but not in current shows recovery", () => {
  const result = detectRegressions({
    currentFingerprints: [],
    pastMetas: [
      makeMeta("session-1.log", [makeFp("gone", "Previously seen error")]),
    ],
  });
  assert.equal(result.disappearingErrors.length, 1);
  assert.equal(result.disappearingErrors[0].hash, "gone");
  assert.equal(result.disappearingErrors[0].lastSeenSession, "session-1.log");
  assert.equal(result.disappearingErrors[0].sessionsAgo, 1);
});

test("disappearing error: sessionsAgo reflects how recent the last sighting was", () => {
  // Past metas ordered oldest -> newest: 3 sessions. Hash 'gone' last seen in session-3 (1 ago).
  // Hash 'older' last seen in session-1 (3 ago).
  const result = detectRegressions({
    currentFingerprints: [],
    pastMetas: [
      makeMeta("session-1.log", [makeFp("older", "Old error")]),
      makeMeta("session-2.log", [makeFp("gone", "Gone error")]),
      makeMeta("session-3.log", [makeFp("gone", "Gone error")]),
    ],
  });
  assert.equal(result.disappearingErrors.length, 2);
  // Sorted most-recent first
  assert.equal(result.disappearingErrors[0].hash, "gone");
  assert.equal(result.disappearingErrors[0].sessionsAgo, 1);
  assert.equal(result.disappearingErrors[1].hash, "older");
  assert.equal(result.disappearingErrors[1].sessionsAgo, 3);
});

// -------- Lookback window --------

test("lookback: respects custom session lookback (older fingerprints ignored)", () => {
  // 12 past sessions, all containing 'ancient' only in the oldest 2. Lookback 5 means only the
  // newest 5 are considered, so 'ancient' should NOT register as past — current's 'ancient'
  // then counts as a NEW error.
  const past: LoadedMeta[] = [];
  for (let i = 1; i <= 12; i++) {
    const fps = i <= 2 ? [makeFp("ancient", "Ancient error")] : [makeFp("recent", "Recent error")];
    past.push(makeMeta(`session-${i}.log`, fps));
  }
  const result = detectRegressions({
    currentFingerprints: [makeFp("ancient", "Ancient error")],
    pastMetas: past,
    lookbackSessions: 5,
  });
  // 'ancient' only in past sessions 1-2 which are outside the 5-session window → new
  assert.equal(result.newErrors.length, 1);
  assert.equal(result.newErrors[0].hash, "ancient");
});

// -------- Signal entry building --------

test("buildRegressionSignalEntries: produces correctly-labeled error/recovery entries", () => {
  const entries = buildRegressionSignalEntries("session-current.log", {
    newErrors: [{ hash: "n1", example: "TypeError: nil call", count: 3 }],
    disappearingErrors: [
      { hash: "d1", example: "TimeoutException", lastSeenSession: "session-prev.log", sessionsAgo: 2 },
    ],
  });
  assert.equal(entries.length, 2);
  const newEntry = entries.find((e) => e.fingerprint.startsWith("regression::new::"));
  assert.ok(newEntry, "expected a regression::new entry");
  assert.match(newEntry.label, /New error type/);
  assert.equal(newEntry.severity, "high");
  const recoverEntry = entries.find((e) => e.fingerprint.startsWith("regression::recovered::"));
  assert.ok(recoverEntry, "expected a regression::recovered entry");
  assert.match(recoverEntry.label, /Resolved \(last seen 2 sessions ago\)/);
  assert.equal(recoverEntry.severity, "low");
});

test("buildRegressionSignalEntries: singular wording for one session ago", () => {
  const entries = buildRegressionSignalEntries("session-current.log", {
    newErrors: [],
    disappearingErrors: [
      { hash: "d1", example: "boom", lastSeenSession: "s-prev.log", sessionsAgo: 1 },
    ],
  });
  assert.equal(entries.length, 1);
  assert.match(entries[0].label, /1 session ago/); // singular, not "sessions"
});

test("buildRegressionSignalEntries: caps each side at 5 entries", () => {
  const newErrors = Array.from({ length: 10 }, (_, i) => ({
    hash: `n${i}`,
    example: `error ${i}`,
    count: 1,
  }));
  const entries = buildRegressionSignalEntries("session-current.log", {
    newErrors,
    disappearingErrors: [],
  });
  assert.equal(entries.length, 5);
});

test("empty input: no new errors, no disappearing errors", () => {
  const result = detectRegressions({
    currentFingerprints: [],
    pastMetas: [],
  });
  assert.equal(result.newErrors.length, 0);
  assert.equal(result.disappearingErrors.length, 0);
});
