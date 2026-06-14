import test from "node:test";
import assert from "node:assert/strict";
import { buildWhyNarrative } from "../../../modules/bug-report/why-narrative";

test("no correlating facts yields an empty narrative (section omitted)", () => {
  assert.equal(buildWhyNarrative({ errorExcerpt: "Boom", sessionCount: 1 }), "");
});

test("blame facts produce a who/when/commit sentence", () => {
  const out = buildWhyNarrative({
    errorExcerpt: "TimeoutException",
    blameAuthor: "craig",
    blameDate: "2026-06-10",
    blameMessage: "increase API timeout",
    blameHashShort: "abc1234",
  });
  assert.match(out, /last changed by craig on 2026-06-10/);
  assert.match(out, /commit `abc1234`: "increase API timeout"/);
  assert.match(out, /\*\*Suggested investigation:\*\*/);
});

test("recurrence across sessions is narrated with the first-seen session", () => {
  const out = buildWhyNarrative({
    errorExcerpt: "RangeError",
    sessionCount: 3,
    firstSeen: "20260610_120000_app.log",
  });
  assert.match(out, /appeared in 3 sessions/);
  assert.match(out, /first seen in `20260610_120000_app\.log`/);
});

test("recently-changed and recurring picks the regression suggestion", () => {
  const out = buildWhyNarrative({
    errorExcerpt: "E",
    blameHashShort: "deadbee",
    sessionCount: 4,
    lineRangeChanges: 2,
  });
  assert.match(out, /surrounding code changed in 2 recent commits/);
  assert.match(out, /regression that keeps recurring/);
});

test("stable but recurring points outward at inputs/dependencies", () => {
  const out = buildWhyNarrative({ errorExcerpt: "E", sessionCount: 5 });
  assert.match(out, /code here has been stable/);
});

test("single recent commit uses singular phrasing", () => {
  const out = buildWhyNarrative({ errorExcerpt: "E", lineRangeChanges: 1 });
  assert.match(out, /1 recent commit\./);
});
