import * as assert from "assert";
import { describe, it } from "mocha";
import { SessionManagerImpl } from "../modules/session-manager";
import { getConfig } from "../modules/config";

// Mock objects for VS Code API and dependencies
const mockStatusBar = {
  updateLineCount: () => {},
  show: () => {},
  hide: () => {},
  setPaused: () => {},
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

  it("should filter by exclusion when captureAll is false", () => {
    const mgr = makeSessionManager();
    mgr.refreshConfig(makeConfig({
      captureAll: false, enabled: true, categories: ["console"], exclusions: ["foo"],
    }));
    let captured = false;
    mgr.addLineListener(() => { captured = true; });
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
    const { parseExclusionPattern } = require("../modules/exclusion-matcher");
    mgr["exclusionRules"] = [parseExclusionPattern("foo")];
    mgr.onOutputEvent("test", { output: "foo", category: "console" });
    assert.ok(
      !captured,
      "Output should be filtered by exclusion when captureAll is false",
    );
  });
});
