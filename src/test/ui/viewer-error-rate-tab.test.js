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
/**
 * Unit tests for error-rate-over-time bucketing and spike detection.
 *
 * Runs the JS from `getErrorRateTabScript()` in a Node vm sandbox
 * and exercises `bucketErrors()` and `detectSpikes()` directly.
 */
const assert = __importStar(require("node:assert"));
const vm = __importStar(require("node:vm"));
const viewer_error_rate_tab_1 = require("../../ui/panels/viewer-error-rate-tab");
function buildSandbox(lines) {
    const ctx = {
        allLines: lines,
        erShowWarnings: true,
        erDetectSpikes: true,
        erBucketSizeSetting: "auto",
        ppEmpty: null,
        ppIdPrefix: "",
        fmtTs: () => "",
        fmtNum: (n) => String(n),
        esc: (s) => s,
        stripTags: (s) => s,
        scrollToLineNumber: () => { },
        document: { getElementById: () => null },
        bucketErrors: undefined,
        detectSpikes: undefined,
    };
    const sandbox = vm.createContext(ctx);
    const script = (0, viewer_error_rate_tab_1.getErrorRateTabScript)();
    vm.runInContext(script, sandbox);
    return sandbox;
}
function bucketErrors(sandbox, lines) {
    sandbox.allLines = lines;
    return vm.runInContext("bucketErrors(allLines)", sandbox);
}
function detectSpikes(sandbox, buckets) {
    return vm.runInContext(`detectSpikes(${JSON.stringify(buckets)})`, sandbox);
}
suite("Error Rate Tab", () => {
    suite("bucketErrors", () => {
        test("should bucket mixed error and warning lines", () => {
            const lines = [
                { type: "line", level: "error", timestamp: 1000 },
                { type: "line", level: "warning", timestamp: 2000 },
                { type: "line", level: "error", timestamp: 3000 },
                { type: "line", level: "info", timestamp: 4000 },
                { type: "line", level: "error", timestamp: 5000 },
            ];
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.ok(result.length > 0, "should produce at least one bucket");
            const totalE = result.reduce((s, b) => s + b.errors, 0);
            const totalW = result.reduce((s, b) => s + b.warnings, 0);
            assert.strictEqual(totalE, 3, "3 errors total");
            assert.strictEqual(totalW, 1, "1 warning total");
        });
        test("should return empty for no errors or warnings", () => {
            const lines = [
                { type: "line", level: "info", timestamp: 1000 },
                { type: "line", level: "debug", timestamp: 2000 },
            ];
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.strictEqual(result.length, 0);
        });
        test("should return single bucket when all timestamps are identical", () => {
            const lines = [
                { type: "line", level: "error", timestamp: 5000 },
                { type: "line", level: "error", timestamp: 5000 },
                { type: "line", level: "warning", timestamp: 5000 },
            ];
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].errors, 2);
            assert.strictEqual(result[0].warnings, 1);
        });
        test("should cap at 200 buckets for very long sessions", () => {
            const lines = [];
            for (let i = 0; i < 500; i++) {
                lines.push({ type: "line", level: "error", timestamp: i * 100000 });
            }
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.ok(result.length <= 200, `got ${result.length} buckets, expected <= 200`);
        });
        test("should skip markers and run-separators", () => {
            const lines = [
                { type: "marker", level: "error", timestamp: 1000 },
                { type: "run-separator", level: "error", timestamp: 2000 },
                { type: "line", level: "error", timestamp: 3000 },
            ];
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            const totalE = result.reduce((s, b) => s + b.errors, 0);
            assert.strictEqual(totalE, 1, "only the line-type error counted");
        });
        test("should exclude warnings when erShowWarnings is false", () => {
            const lines = [
                { type: "line", level: "error", timestamp: 1000 },
                { type: "line", level: "warning", timestamp: 2000 },
            ];
            const sandbox = buildSandbox(lines);
            sandbox.erShowWarnings = false;
            const result = bucketErrors(sandbox, lines);
            const totalW = result.reduce((s, b) => s + b.warnings, 0);
            assert.strictEqual(totalW, 0, "warnings excluded");
        });
        test("should track firstIdx per bucket", () => {
            const lines = [
                { type: "line", level: "info", timestamp: 1000 },
                { type: "line", level: "error", timestamp: 1000 },
            ];
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.strictEqual(result[0].firstIdx, 1, "firstIdx points to the error line");
        });
    });
    suite("detectSpikes", () => {
        test("should flag a burst after quiet period", () => {
            const buckets = [
                { startMs: 0, errors: 1, warnings: 0 },
                { startMs: 1, errors: 1, warnings: 0 },
                { startMs: 2, errors: 1, warnings: 0 },
                { startMs: 3, errors: 1, warnings: 0 },
                { startMs: 4, errors: 1, warnings: 0 },
                { startMs: 5, errors: 20, warnings: 0 },
            ];
            const sandbox = buildSandbox([]);
            const flags = detectSpikes(sandbox, buckets);
            assert.strictEqual(flags[5], true, "last bucket is a spike");
        });
        test("should not flag when all buckets are equal", () => {
            const buckets = Array.from({ length: 10 }, (_, i) => ({
                startMs: i, errors: 5, warnings: 0,
            }));
            const sandbox = buildSandbox([]);
            const flags = detectSpikes(sandbox, buckets);
            const spikeCount = flags.filter(Boolean).length;
            assert.strictEqual(spikeCount, 0, "no spikes in uniform data");
        });
        test("should handle fewer than 5 buckets without crashing", () => {
            const buckets = [
                { startMs: 0, errors: 1, warnings: 0 },
                { startMs: 1, errors: 10, warnings: 0 },
            ];
            const sandbox = buildSandbox([]);
            const flags = detectSpikes(sandbox, buckets);
            assert.strictEqual(flags.length, 2);
        });
        test("should return empty for empty input", () => {
            const sandbox = buildSandbox([]);
            const flags = detectSpikes(sandbox, []);
            assert.strictEqual(flags.length, 0);
        });
    });
});
//# sourceMappingURL=viewer-error-rate-tab.test.js.map