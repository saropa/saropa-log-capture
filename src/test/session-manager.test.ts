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

describe("SessionManagerImpl", () => {
  it("should capture all output when captureAll is true", () => {
    const mgr = makeSessionManager();
    // Patch getConfig to always return captureAll: true
    const origGetConfig = getConfig;
    (require("../modules/config") as any).getConfig = () => ({
      ...origGetConfig(),
      captureAll: true,
      enabled: true,
      categories: [],
      exclusions: [],
    });
    let captured = false;
    mgr.addLineListener(() => {
      captured = true;
    });
    // Should not filter by category or exclusion
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
    mgr.onOutputEvent("test", { output: "foo", category: "system" });
    assert.ok(captured, "Output should be captured when captureAll is true");
    (require("../modules/config") as any).getConfig = origGetConfig;
  });

  it("should filter by category when captureAll is false", () => {
    const mgr = makeSessionManager();
    // Patch getConfig to always return captureAll: false, categories: ["console"]
    const origGetConfig = getConfig;
    (require("../modules/config") as any).getConfig = () => ({
      ...origGetConfig(),
      captureAll: false,
      enabled: true,
      categories: ["console"],
      exclusions: [],
    });
    let captured = false;
    mgr.addLineListener(() => {
      captured = true;
    });
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
    mgr.onOutputEvent("test", { output: "foo", category: "system" });
    assert.ok(
      !captured,
      "Output should be filtered by category when captureAll is false",
    );
    (require("../modules/config") as any).getConfig = origGetConfig;
  });

  it("should filter by exclusion when captureAll is false", () => {
    const mgr = makeSessionManager();
    // Patch getConfig to always return captureAll: false, exclusions: ["foo"], categories: ["console"]
    const origGetConfig = getConfig;
    (require("../modules/config") as any).getConfig = () => ({
      ...origGetConfig(),
      captureAll: false,
      enabled: true,
      categories: ["console"],
      exclusions: ["foo"],
    });
    let captured = false;
    mgr.addLineListener(() => {
      captured = true;
    });
    mgr["sessions"].set("test", { appendLine: () => {}, lineCount: 1 } as any);
    // Manually set exclusionRules to match exclusions in config
    const { parseExclusionPattern } = require("../modules/exclusion-matcher");
    mgr["exclusionRules"] = [parseExclusionPattern("foo")];
    mgr.onOutputEvent("test", { output: "foo", category: "console" });
    assert.ok(
      !captured,
      "Output should be filtered by exclusion when captureAll is false",
    );
    (require("../modules/config") as any).getConfig = origGetConfig;
  });
});
