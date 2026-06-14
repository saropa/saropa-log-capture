import * as assert from "assert";
import { describe, it } from "mocha";
import { SessionManagerImpl } from "../../../modules/session/session-manager";
import { getConfig } from "../../../modules/config/config";

// Mock objects for VS Code API and dependencies
const mockStatusBar = {
  updateLineCount: () => {},
  show: () => {},
  hide: () => {},
  setPaused: () => {},
  updateWatchCounts: () => {},
};
const mockOutputChannel = { appendLine: () => {} };

function makeSessionManager() {
  return new SessionManagerImpl(mockStatusBar as any, mockOutputChannel as any);
}

/** Build a config override, merging with defaults from getConfig(). */
function makeConfig(overrides: Record<string, unknown>) {
  return { ...getConfig(), ...overrides } as ReturnType<typeof getConfig>;
}

describe("SessionManagerImpl", () => {
  it("should capture all output when captureAll is true", () => {
    const mgr = makeSessionManager();
    mgr.refreshConfig(makeConfig({
      captureAll: true, enabled: true, categories: [], exclusions: [],
    }));
    let captured = false;
    mgr.addLineListener(() => { captured = true; });
    // fileUri is required: broadcastLine reads session.fileUri.fsPath (added in b916c032).
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1, fileUri: { fsPath: "test.log" } } as any);
    mgr.onOutputEvent("test", { output: "foo", category: "system" });
    assert.ok(captured, "Output should be captured when captureAll is true");
  });

  it("should filter by category when captureAll is false", () => {
    const mgr = makeSessionManager();
    mgr.refreshConfig(makeConfig({
      captureAll: false, enabled: true, categories: ["console"], exclusions: [],
    }));
    let captured = false;
    mgr.addLineListener(() => { captured = true; });
    // fileUri is required: broadcastLine reads session.fileUri.fsPath (added in b916c032).
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1, fileUri: { fsPath: "test.log" } } as any);
    mgr.onOutputEvent("test", { output: "foo", category: "system" });
    assert.ok(
      !captured,
      "Output should be filtered by category when captureAll is false",
    );
  });

  it("should log a dropped DAP category once to the output channel (plan 102)", () => {
    // Plan 102 Step 3: a category filtered out by the captureAll whitelist must be
    // surfaced (once) so a "missing line" is diagnosable, not silently lost.
    const logged: string[] = [];
    const mgr = new SessionManagerImpl(
      mockStatusBar as any,
      { appendLine: (m: string) => logged.push(m) } as any,
    );
    mgr.refreshConfig(makeConfig({
      captureAll: false, enabled: true, categories: ["console"], exclusions: [],
    }));
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1, fileUri: { fsPath: "test.log" } } as any);
    // Two stdout lines (not whitelisted) plus one stderr line: each unrecognized
    // category should log exactly once, regardless of how many lines it drops.
    mgr.onOutputEvent("test", { output: "a", category: "stdout" });
    mgr.onOutputEvent("test", { output: "b", category: "stdout" });
    mgr.onOutputEvent("test", { output: "c", category: "stderr" });
    const dropMsgs = logged.filter((m) => m.includes("Dropped DAP output category"));
    assert.strictEqual(dropMsgs.length, 2, "each dropped category logs exactly once");
    assert.ok(dropMsgs.some((m) => m.includes('"stdout"')), "names the stdout category");
    assert.ok(dropMsgs.some((m) => m.includes('"stderr"')), "names the stderr category");
  });

  it("should log an excluded line once per pattern to the output channel (plan 102)", () => {
    // Plan 102: with captureAll ON, an exclusion match is the only silent in-extension
    // drop once a line clears the category gate — surface the matching pattern once so a
    // "missing Debug Console line" is diagnosable rather than looking like broken capture.
    const logged: string[] = [];
    const mgr = new SessionManagerImpl(
      mockStatusBar as any,
      { appendLine: (m: string) => logged.push(m) } as any,
    );
    mgr.refreshConfig(makeConfig({
      captureAll: true, enabled: true, categories: [], exclusions: ["noise"],
    }));
    // exclusionRules is normally built on session start; set it directly for the unit test.
    mgr["exclusionRules"] = [{ source: "noise", text: "noise" }];
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1, fileUri: { fsPath: "test.log" } } as any);
    // Two distinct lines hit the same pattern; the pattern is reported exactly once.
    mgr.onOutputEvent("test", { output: "noise line 1", category: "stdout" });
    mgr.onOutputEvent("test", { output: "noise line 2", category: "stdout" });
    const hidMsgs = logged.filter((m) => m.includes("matching exclusion pattern"));
    assert.strictEqual(hidMsgs.length, 1, "each exclusion pattern logs exactly once");
    assert.ok(hidMsgs[0].includes('"noise"'), "names the matching pattern");
  });

  it("should trace each output event's fate when diagnosticCapture is on (plan 102)", () => {
    // Plan 102 Step 1: with diagnosticCapture on, every received DAP output event logs its
    // fate, so a "missing line" is classifiable — a Debug Console line present in the trace
    // was received (disposition says what happened); one absent was never delivered via DAP.
    const logged: string[] = [];
    const mgr = new SessionManagerImpl(
      mockStatusBar as any,
      { appendLine: (m: string) => logged.push(m) } as any,
    );
    mgr.refreshConfig(makeConfig({
      captureAll: true, enabled: true, categories: [], exclusions: ["noise"],
      diagnosticCapture: true,
    }));
    mgr["exclusionRules"] = [{ source: "noise", text: "noise" }];
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1, fileUri: { fsPath: "test.log" } } as any);
    mgr.onOutputEvent("test", { output: "kept line", category: "stdout" });
    mgr.onOutputEvent("test", { output: "noise dropped", category: "stdout" });
    const traces = logged.filter((m) => m.includes("Capture diagnostic: DAP output"));
    assert.strictEqual(traces.length, 2, "every received output event is traced");
    assert.ok(traces.some((m) => m.includes("-> captured") && m.includes("kept line")), "traces the captured line");
    assert.ok(traces.some((m) => m.includes("dropped (exclusion") && m.includes("noise dropped")), "traces the dropped line + reason");
  });

  it("writeLine should no-op when no active session exists", () => {
    const mgr = makeSessionManager();
    let captured = false;
    mgr.addLineListener(() => { captured = true; });
    mgr.writeLine("hello", "console", new Date());
    assert.strictEqual(captured, false, "writeLine should not broadcast without an active session");
  });

  it("should filter by exclusion when captureAll is false", () => {
    const mgr = makeSessionManager();
    mgr.refreshConfig(makeConfig({
      captureAll: false, enabled: true, categories: ["console"], exclusions: ["foo"],
    }));
    let captured = false;
    mgr.addLineListener(() => { captured = true; });
    // fileUri is required: broadcastLine reads session.fileUri.fsPath (added in b916c032).
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1, fileUri: { fsPath: "test.log" } } as any);
    const { parseExclusionPattern } = require("../../../modules/features/exclusion-matcher");
    mgr["exclusionRules"] = [parseExclusionPattern("foo")];
    mgr.onOutputEvent("test", { output: "foo", category: "console" });
    assert.ok(
      !captured,
      "Output should be filtered by exclusion when captureAll is false",
    );
  });

  it("onProcessId stores debug target PID for later use at session end", () => {
    const mgr = makeSessionManager();
    mgr.onProcessId("session-1", 12345);
    assert.strictEqual(mgr["processIds"].get("session-1"), 12345, "PID should be stored by session id");
    mgr.onProcessId("session-1", 67890);
    assert.strictEqual(mgr["processIds"].get("session-1"), 67890, "Later process event should overwrite PID");
  });

  it("getActiveLastWriteTime returns undefined when no active debug session", () => {
    const mgr = makeSessionManager();
    assert.strictEqual(mgr.getActiveLastWriteTime(), undefined, "no active session => undefined");
  });

  it("logToOutputChannel writes to the extension output channel", () => {
    const messages: string[] = [];
    const oc = { appendLine: (s: string) => { messages.push(s); } };
    const mgr = new SessionManagerImpl(mockStatusBar as any, oc as any);
    mgr.logToOutputChannel("test message");
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0], "test message");
  });
});
