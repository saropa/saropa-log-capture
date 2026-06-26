import test from "node:test";
import assert from "node:assert/strict";
import { buildInvestigationOverview } from "../../../modules/session/investigation-overview";
import type { Investigation } from "../../../modules/session/investigation-model";

const inv: Investigation = {
  id: "a",
  title: "Bug #42: Payment timeout",
  notes: "Root cause was connection pool exhaustion",
  sessionKeys: ["reports/first.log", "reports/fix1.log"],
  createdAt: 0,
};

test("overview renders title, notes, and a numbered session list with counts", () => {
  const md = buildInvestigationOverview(inv, [
    { key: "reports/first.log", displayName: "first.log", errorCount: 3, warningCount: 1 },
    { key: "reports/fix1.log", displayName: "fix1.log", errorCount: 0, note: "after fix — clean!" },
  ]);
  assert.match(md, /^# Investigation: Bug #42: Payment timeout/);
  assert.match(md, /Root cause was connection pool exhaustion/);
  assert.match(md, /## Sessions \(2\)/);
  assert.match(md, /1\. \*\*first\.log\*\* — 3 errors, 1 warning/);
  // Zero counts are omitted; the note still renders.
  assert.match(md, /2\. \*\*fix1\.log\*\* — _after fix — clean!_/);
});

test("a single error/warning is not pluralized", () => {
  const md = buildInvestigationOverview(inv, [
    { key: "k", displayName: "one.log", errorCount: 1, warningCount: 1 },
  ]);
  assert.match(md, /\*\*one\.log\*\* — 1 error, 1 warning/);
});

test("a member with a link renders a markdown link", () => {
  const md = buildInvestigationOverview(inv, [
    { key: "k", displayName: "linked.log", link: "vscode://file/d:/r/linked.log" },
  ]);
  assert.match(md, /\[linked\.log\]\(vscode:\/\/file\/d:\/r\/linked\.log\)/);
});

test("empty notes fall back to a placeholder and no sessions states so", () => {
  const md = buildInvestigationOverview({ ...inv, notes: "  " }, []);
  assert.match(md, /\*No notes yet\.\*/);
  assert.match(md, /## Sessions \(0\)/);
  assert.match(md, /\*No sessions added yet\.\*/);
});
