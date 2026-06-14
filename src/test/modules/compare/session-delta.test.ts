import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSessionDelta,
  formatSessionDelta,
  isEmptyDelta,
} from "../../../modules/compare/session-delta";
import type { SessionMeta } from "../../../modules/session/session-metadata";
import type { FingerprintEntry } from "../../../modules/analysis/error-fingerprint";

function fp(h: string, e: string): FingerprintEntry {
  return { h, e, n: e, c: 1 };
}

function meta(over: Partial<SessionMeta>): SessionMeta {
  return { ...over } as SessionMeta;
}

// -------- no predecessor --------

test("no previous session yields a non-comparison flagged hasPrevious=false", () => {
  const d = computeSessionDelta(meta({ errorCount: 3 }), undefined);
  assert.equal(d.hasPrevious, false);
  assert.ok(isEmptyDelta(d));
  assert.equal(formatSessionDelta(d), "");
});

// -------- count deltas --------

test("error and warning count deltas are signed differences vs the previous session", () => {
  const d = computeSessionDelta(
    meta({ errorCount: 5, warningCount: 2 }),
    meta({ errorCount: 3, warningCount: 7 }),
  );
  assert.equal(d.errorCountDelta, 2);
  assert.equal(d.warningCountDelta, -5);
});

// -------- new / resolved error fingerprints --------

test("fingerprints present now but not before are new; present before but not now are resolved", () => {
  const d = computeSessionDelta(
    meta({ fingerprints: [fp("h1", "TimeoutException"), fp("h2", "RangeError")] }),
    meta({ fingerprints: [fp("h2", "RangeError"), fp("h3", "StateError")] }),
  );
  assert.deepEqual(d.newErrors, ["TimeoutException"]);
  assert.deepEqual(d.resolvedErrors, ["StateError"]);
});

// -------- new source files from file: correlation tags --------

test("source files referenced only this session surface as new", () => {
  const d = computeSessionDelta(
    meta({ correlationTags: ["file:lib/a.dart", "file:lib/b.dart", "error:Foo"] }),
    meta({ correlationTags: ["file:lib/a.dart"] }),
  );
  assert.deepEqual(d.newSourceFiles, ["lib/b.dart"]);
});

// -------- empty delta / formatting --------

test("identical sessions produce an empty delta and no summary text", () => {
  const same = meta({ errorCount: 1, fingerprints: [fp("h1", "E")], correlationTags: ["file:a"] });
  const d = computeSessionDelta(same, meta({ errorCount: 1, fingerprints: [fp("h1", "E")], correlationTags: ["file:a"] }));
  assert.ok(isEmptyDelta(d));
  assert.equal(formatSessionDelta(d), "");
});

test("a non-empty delta formats one fact per line led by a header", () => {
  const d = computeSessionDelta(
    meta({ errorCount: 2, fingerprints: [fp("h1", "NewErr")] }),
    meta({ errorCount: 1 }),
  );
  const text = formatSessionDelta(d);
  assert.match(text, /^Since last session:/);
  assert.match(text, /errors \+1/);
  assert.match(text, /1 new error type\(s\): NewErr/);
});
