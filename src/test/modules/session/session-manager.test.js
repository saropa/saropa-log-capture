"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const mocha_1 = require("mocha");
const session_manager_1 = require("../../../modules/session/session-manager");
const config_1 = require("../../../modules/config/config");
// Mock objects for VS Code API and dependencies
const mockStatusBar = {
    updateLineCount: () => { },
    show: () => { },
    hide: () => { },
    setPaused: () => { },
    updateWatchCounts: () => { },
};
const mockOutputChannel = { appendLine: () => { } };
function makeSessionManager() {
    return new session_manager_1.SessionManagerImpl(mockStatusBar, mockOutputChannel);
}
/** Build a config override, merging with defaults from getConfig(). */
function makeConfig(overrides) {
    return { ...(0, config_1.getConfig)(), ...overrides };
}
(0, mocha_1.describe)("SessionManagerImpl", () => {
    (0, mocha_1.it)("should capture all output when captureAll is true", () => {
        const mgr = makeSessionManager();
        mgr.refreshConfig(makeConfig({
            captureAll: true, enabled: true, categories: [], exclusions: [],
        }));
        let captured = false;
        mgr.addLineListener(() => { captured = true; });
        mgr["sessions"].set("test", { appendLine: () => { }, lineCount: 1 });
        mgr.onOutputEvent("test", { output: "foo", category: "system" });
        assert.ok(captured, "Output should be captured when captureAll is true");
    });
    (0, mocha_1.it)("should filter by category when captureAll is false", () => {
        const mgr = makeSessionManager();
        mgr.refreshConfig(makeConfig({
            captureAll: false, enabled: true, categories: ["console"], exclusions: [],
        }));
        let captured = false;
        mgr.addLineListener(() => { captured = true; });
        mgr["sessions"].set("test", { appendLine: () => { }, lineCount: 1 });
        mgr.onOutputEvent("test", { output: "foo", category: "system" });
        assert.ok(!captured, "Output should be filtered by category when captureAll is false");
    });
    (0, mocha_1.it)("writeLine should no-op when no active session exists", () => {
        const mgr = makeSessionManager();
        let captured = false;
        mgr.addLineListener(() => { captured = true; });
        mgr.writeLine("hello", "console", new Date());
        assert.strictEqual(captured, false, "writeLine should not broadcast without an active session");
    });
    (0, mocha_1.it)("should filter by exclusion when captureAll is false", () => {
        const mgr = makeSessionManager();
        mgr.refreshConfig(makeConfig({
            captureAll: false, enabled: true, categories: ["console"], exclusions: ["foo"],
        }));
        let captured = false;
        mgr.addLineListener(() => { captured = true; });
        mgr["sessions"].set("test", { appendLine: () => { }, lineCount: 1 });
        const { parseExclusionPattern } = require("../../../modules/features/exclusion-matcher");
        mgr["exclusionRules"] = [parseExclusionPattern("foo")];
        mgr.onOutputEvent("test", { output: "foo", category: "console" });
        assert.ok(!captured, "Output should be filtered by exclusion when captureAll is false");
    });
    (0, mocha_1.it)("onProcessId stores debug target PID for later use at session end", () => {
        const mgr = makeSessionManager();
        mgr.onProcessId("session-1", 12345);
        assert.strictEqual(mgr["processIds"].get("session-1"), 12345, "PID should be stored by session id");
        mgr.onProcessId("session-1", 67890);
        assert.strictEqual(mgr["processIds"].get("session-1"), 67890, "Later process event should overwrite PID");
    });
    (0, mocha_1.it)("getActiveLastWriteTime returns undefined when no active debug session", () => {
        const mgr = makeSessionManager();
        assert.strictEqual(mgr.getActiveLastWriteTime(), undefined, "no active session => undefined");
    });
    (0, mocha_1.it)("logToOutputChannel writes to the extension output channel", () => {
        const messages = [];
        const oc = { appendLine: (s) => { messages.push(s); } };
        const mgr = new session_manager_1.SessionManagerImpl(mockStatusBar, oc);
        mgr.logToOutputChannel("test message");
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0], "test message");
    });
});
//# sourceMappingURL=session-manager.test.js.map