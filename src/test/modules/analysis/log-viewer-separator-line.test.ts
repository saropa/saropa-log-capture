import * as assert from "assert";
import { isLogViewerSeparatorLine } from "../../../modules/analysis/log-viewer-separator-line";

suite("log-viewer-separator-line (viewer banner / rule detection)", () => {
    suite("before: generic logs are not separators", () => {
        test("plain Drift SQL line is not a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter: Drift: Sent SELECT * FROM "contacts"; with args []'),
                false,
            );
        });
        test("short non-art line is not a separator", () => {
            assert.strictEqual(isLogViewerSeparatorLine("hi"), false);
        });
    });

    suite("logcat-prefixed lines strip prefix before detection", () => {
        test("logcat-prefixed paired │ … │ content line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): │           DRIFT DEBUG SERVER   v3.0.2           │'),
                true,
            );
        });
        test("logcat-prefixed border line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): ┌──────────────────────────────────────────────────┐'),
                true,
            );
        });
        test("logcat-prefixed empty interior row is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): \u2502                                                      \u2502'),
                true,
            );
        });
        test("bracket-prefixed box line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('[log] │         http://127.0.0.1:8643         │'),
                true,
            );
        });
        test("logcat-prefixed plain text is not a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): Starting application...'),
                false,
            );
        });
    });

    suite("double-vertical-bar (║) boxes (e.g. Isar Connect)", () => {
        test("logcat-prefixed ║ content line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ║                     ISAR CONNECT STARTED                     ║'),
                true,
            );
        });
        test("logcat-prefixed ║ URL content line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ║ https://inspect.isar-community.dev/3.3.0/#/37391/Q3SG7NeTAHc ║'),
                true,
            );
        });
        test("logcat-prefixed ╔ border line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ╔══════════════════════════════════════════════════════════════╗'),
                true,
            );
        });
        test("logcat-prefixed ╟ divider line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ╟──────────────────────────────────────────────────────────────╢'),
                true,
            );
        });
    });

    suite("after: Drift-style and Unicode box lines", () => {
        test("paired │ … │ interior row (Drift URL line)", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("      │              http://127.0.0.1:8642               │"),
                true,
            );
        });
        test("paired │ … │ title row", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("│           DRIFT DEBUG SERVER   v2.10.0           │"),
                true,
            );
        });
        test("╭/╯ border row (corners counted as art — previously missed without ╭╮╯╰ in set)", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("╭──────────────────────────────────────────────────╮"),
                true,
            );
        });
        test("paired │ │ empty interior row (whitespace only between bars)", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("\u2502                                                      \u2502"),
                true,
            );
        });
        test("classic === rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine("==============================="), true);
        });
    });
});
