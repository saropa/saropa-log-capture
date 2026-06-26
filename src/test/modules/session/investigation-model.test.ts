import test from "node:test";
import assert from "node:assert/strict";
import {
  type Investigation,
  upsertInvestigation,
  removeInvestigationById,
  renameInvestigation,
  setInvestigationNotes,
  addSessionKey,
  removeSessionKey,
  findById,
  investigationsContaining,
} from "../../../modules/session/investigation-model";

function make(id: string, sessionKeys: string[] = []): Investigation {
  return { id, title: `T-${id}`, notes: "", sessionKeys, createdAt: 0 };
}

test("upsert adds a new investigation and replaces one with the same id", () => {
  const a = make("a");
  const list = upsertInvestigation([], a);
  assert.equal(list.length, 1);
  const replaced = upsertInvestigation(list, { ...a, title: "renamed" });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].title, "renamed");
});

test("operations are immutable — the input array is never mutated", () => {
  const original = [make("a")];
  removeInvestigationById(original, "a");
  renameInvestigation(original, "a", "x");
  addSessionKey(original, "a", "k");
  assert.equal(original.length, 1);
  assert.equal(original[0].title, "T-a");
  assert.deepEqual(original[0].sessionKeys, []);
});

test("rename and setNotes change only the matching investigation", () => {
  const list = [make("a"), make("b")];
  const renamed = renameInvestigation(list, "a", "Bug 42");
  assert.equal(findById(renamed, "a")!.title, "Bug 42");
  assert.equal(findById(renamed, "b")!.title, "T-b");
  const noted = setInvestigationNotes(renamed, "b", "pool exhaustion");
  assert.equal(findById(noted, "b")!.notes, "pool exhaustion");
});

test("addSessionKey de-duplicates so a session is never listed twice", () => {
  let list = [make("a")];
  list = addSessionKey(list, "a", "reports/x.log");
  list = addSessionKey(list, "a", "reports/x.log");
  assert.deepEqual(findById(list, "a")!.sessionKeys, ["reports/x.log"]);
});

test("removeSessionKey drops only that key and is a no-op when absent", () => {
  const list = [make("a", ["reports/x.log", "reports/y.log"])];
  const removed = removeSessionKey(list, "a", "reports/x.log");
  assert.deepEqual(findById(removed, "a")!.sessionKeys, ["reports/y.log"]);
  const noop = removeSessionKey(removed, "a", "reports/missing.log");
  assert.deepEqual(findById(noop, "a")!.sessionKeys, ["reports/y.log"]);
});

test("investigationsContaining finds every investigation holding a session", () => {
  const list = [
    make("a", ["reports/x.log"]),
    make("b", ["reports/x.log", "reports/y.log"]),
    make("c", ["reports/z.log"]),
  ];
  const hits = investigationsContaining(list, "reports/x.log");
  assert.deepEqual(hits.map((i) => i.id).sort(), ["a", "b"]);
  assert.deepEqual(investigationsContaining(list, "reports/none.log"), []);
});

test("removeInvestigationById removes the whole investigation", () => {
  const list = [make("a"), make("b")];
  const removed = removeInvestigationById(list, "a");
  assert.deepEqual(removed.map((i) => i.id), ["b"]);
});
