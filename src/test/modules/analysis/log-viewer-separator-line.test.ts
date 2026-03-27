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
        test("classic === rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine("==============================="), true);
        });
    });
});
