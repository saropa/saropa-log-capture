import test from "node:test";
import assert from "node:assert/strict";
import {
  findLargestContextGap,
  formatContextGapNote,
  findContextBoundary,
  formatContextInsights,
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

// ── Smart Context Boundaries (idea #1) ──────────────────────────────────────

test("a timestamp gap is the operation boundary, nearest one to the error wins", () => {
  const boundary = findContextBoundary(lines);
  assert.ok(boundary);
  assert.equal(boundary!.reason, "gap");
  assert.equal(boundary!.gapMs, 5000);
  // The 5s gap precedes "Waiting for response" at index 2 — the operation starts there.
  assert.equal(boundary!.startIndex, 2);
});

test("a blank line is a stronger separator and beats a gap further back", () => {
  const withBlank = [
    "2026-03-12T14:32:02.000Z prior operation",
    "2026-03-12T14:32:09.000Z still prior (5s gap above)",
    "",
    "2026-03-12T14:32:09.500Z failing operation begins",
    "2026-03-12T14:32:09.600Z TimeoutException",
  ];
  const boundary = findContextBoundary(withBlank);
  assert.ok(boundary);
  assert.equal(boundary!.reason, "blank");
  assert.equal(boundary!.startIndex, 3);
});

test("severity escalation is a weak fallback when no blank/gap separates the window", () => {
  const escalating = [
    "I/flutter: building widget tree",
    "I/flutter: laying out children",
    "E/flutter: RenderFlex overflowed by 42 pixels",
  ];
  const boundary = findContextBoundary(escalating);
  assert.ok(boundary);
  assert.equal(boundary!.reason, "level");
  assert.equal(boundary!.startIndex, 2);
});

test("line-to-line level flips do not create a boundary without an escalation", () => {
  // info → debug → info is not an escalation (never enters warn/error), so no boundary.
  const flips = ["INFO: a", "DEBUG: b", "INFO: c"];
  assert.equal(findContextBoundary(flips), undefined);
});

test("a single line has no boundary", () => {
  assert.equal(findContextBoundary(["only one line"]), undefined);
});

test("insights fold the pause into the boundary note when they describe the same gap", () => {
  const notes = formatContextInsights(lines);
  // Boundary reason is the 5s gap, so the standalone largest-pause note is suppressed.
  assert.equal(notes.length, 1);
  assert.match(notes[0], /Operation boundary/);
  assert.match(notes[0], /5\.0s pause/);
});

test("insights show both notes when the boundary is not the largest pause", () => {
  const withBlank = [
    "2026-03-12T14:32:02.000Z op A start",
    "2026-03-12T14:32:10.000Z op A end (8s gap, the largest pause)",
    "",
    "2026-03-12T14:32:10.500Z op B start",
    "2026-03-12T14:32:10.600Z FAILED",
  ];
  const notes = formatContextInsights(withBlank);
  assert.equal(notes.length, 2);
  assert.match(notes[0], /Operation boundary.*blank-line separator/);
  assert.match(notes[1], /Largest pause in this context: 8\.0s/);
});

test("no boundary and no gap yields no insight notes", () => {
  assert.deepEqual(formatContextInsights(["just a message", "another message"]), []);
});
