import test from "node:test";
import assert from "node:assert/strict";
import {
  findLargestContextGap,
  formatContextGapNote,
} from "../../../modules/bug-report/time-travel-context";

const lines = [
  "2026-03-12T14:32:02.000Z Fetching user profile for abc123",
  "2026-03-12T14:32:04.000Z API request: GET /api/v2/users/abc123",
  "2026-03-12T14:32:09.000Z Waiting for response", // 5s gap — the largest
  "2026-03-12T14:32:09.500Z TimeoutException: Future not completed",
];

test("finds the largest pause and the line that follows it", () => {
  const gap = findLargestContextGap(lines);
  assert.ok(gap);
  assert.equal(gap!.gapMs, 5000);
  assert.match(gap!.afterLine, /Waiting for response/);
});

test("no parseable timestamps yields no gap", () => {
  assert.equal(findLargestContextGap(["just a message", "another message"]), undefined);
});

test("all sub-threshold gaps yield no gap", () => {
  const tight = [
    "2026-03-12T14:32:02.000Z a",
    "2026-03-12T14:32:02.200Z b",
    "2026-03-12T14:32:02.400Z c",
  ];
  assert.equal(findLargestContextGap(tight), undefined);
});

test("the note renders the gap in seconds and quotes the following line", () => {
  const note = formatContextGapNote(lines);
  assert.match(note, /Largest pause in this context: 5\.0s before/);
  assert.match(note, /Waiting for response/);
});

test("empty context produces no note", () => {
  assert.equal(formatContextGapNote([]), "");
});
