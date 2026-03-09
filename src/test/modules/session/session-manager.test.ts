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
  updateIntegrationAdapters: () => {},
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
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
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
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
    mgr.onOutputEvent("test", { output: "foo", category: "system" });
    assert.ok(
      !captured,
      "Output should be filtered by category when captureAll is false",
    );
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
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
    const { parseExclusionPattern } = require("../../../modules/features/exclusion-matcher");
    mgr["exclusionRules"] = [parseExclusionPattern("foo")];
    mgr.onOutputEvent("test", { output: "foo", category: "console" });
    assert.ok(
      !captured,
      "Output should be filtered by exclusion when captureAll is false",
    );
  });
});
