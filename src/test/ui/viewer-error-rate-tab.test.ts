/**
 * Unit tests for error-rate-over-time bucketing and spike detection.
 *
 * Runs the JS from `getErrorRateTabScript()` in a Node vm sandbox
 * and exercises `bucketErrors()` and `detectSpikes()` directly.
 */
import * as assert from "node:assert";
import * as vm from "node:vm";
import { getErrorRateTabScript } from "../../ui/panels/viewer-error-rate-tab";

/** Minimal line item shape matching webview allLines entries. */
interface MockLine {
    readonly type: string;
    readonly level: string;
    readonly timestamp: number;
}

function buildSandbox(lines: readonly MockLine[]): vm.Context {
    const ctx = {
        allLines: lines,
        erShowWarnings: true,
        erDetectSpikes: true,
        erBucketSizeSetting: "auto",
        ppEmpty: null,
        ppIdPrefix: "",
        fmtTs: () => "",
        fmtNum: (n: number) => String(n),
        esc: (s: string) => s,
        stripTags: (s: string) => s,
        scrollToLineNumber: () => { /* no-op */ },
        document: { getElementById: () => null },
        bucketErrors: undefined as unknown,
        detectSpikes: undefined as unknown,
    };
    const sandbox = vm.createContext(ctx);
    const script = getErrorRateTabScript();
    vm.runInContext(script, sandbox);
    return sandbox;
}

function bucketErrors(
    sandbox: vm.Context,
    lines: readonly MockLine[],
): Array<{ startMs: number; errors: number; warnings: number; firstIdx: number }> {
    sandbox.allLines = lines;
    return vm.runInContext("bucketErrors(allLines)", sandbox) as Array<{
        startMs: number; errors: number; warnings: number; firstIdx: number;
    }>;
}

function detectSpikes(
    sandbox: vm.Context,
    buckets: readonly { errors: number; warnings: number }[],
): boolean[] {
    return vm.runInContext(
        `detectSpikes(${JSON.stringify(buckets)})`,
        sandbox,
    ) as boolean[];
}

suite("Error Rate Tab", () => {
    suite("bucketErrors", () => {
        test("should bucket mixed error and warning lines", () => {
            const lines: MockLine[] = [
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
            const lines: MockLine[] = [
                { type: "line", level: "info", timestamp: 1000 },
                { type: "line", level: "debug", timestamp: 2000 },
            ];
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.strictEqual(result.length, 0);
        });

        test("should return single bucket when all timestamps are identical", () => {
            const lines: MockLine[] = [
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
            const lines: MockLine[] = [];
            for (let i = 0; i < 500; i++) {
                lines.push({ type: "line", level: "error", timestamp: i * 100000 });
            }
            const sandbox = buildSandbox(lines);
            const result = bucketErrors(sandbox, lines);
            assert.ok(result.length <= 200, `got ${result.length} buckets, expected <= 200`);
        });

        test("should skip markers and run-separators", () => {
            const lines: MockLine[] = [
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
            const lines: MockLine[] = [
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
            const lines: MockLine[] = [
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
