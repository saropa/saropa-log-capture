import * as assert from "node:assert";
import { getInteractiveStyles, getSimpleHtmlExportStyles } from "../../../modules/export/html-export-styles";
import {
    isPlainTextBlankAfterAnsi,
    normalizeTextForBlankLineCheck,
} from "../../../modules/misc/blank-line-text";

suite("blank-line-text", () => {
    test("normalize maps NBSP to space and strips ZWSP", () => {
        assert.strictEqual(normalizeTextForBlankLineCheck("\u00A0\u200B"), " ");
        assert.strictEqual(normalizeTextForBlankLineCheck("a\u00A0b"), "a b");
    });

    test("normalize strips leading BOM", () => {
        assert.strictEqual(normalizeTextForBlankLineCheck("\uFEFF  x"), "  x");
    });

    test("normalize maps common nbsp entities", () => {
        assert.strictEqual(normalizeTextForBlankLineCheck("&nbsp;"), " ");
        assert.strictEqual(normalizeTextForBlankLineCheck("&#160;"), " ");
    });

    test("normalize maps decimal and hex HTML entities for ASCII / NBSP space", () => {
        assert.strictEqual(normalizeTextForBlankLineCheck("&#32;"), " ");
        assert.strictEqual(normalizeTextForBlankLineCheck("&#x20;"), " ");
        assert.strictEqual(isPlainTextBlankAfterAnsi("&#32;&#x20;"), true);
    });

    test("isPlainTextBlankAfterAnsi: true for NBSP-only and ANSI-only reset", () => {
        assert.strictEqual(isPlainTextBlankAfterAnsi("\u00A0\u200B"), true);
        assert.strictEqual(isPlainTextBlankAfterAnsi("\x1b[0m\x1b[32m\x1b[0m"), true);
        assert.strictEqual(isPlainTextBlankAfterAnsi("hello"), false);
    });

    test("interactive HTML export styles include quarter-height line-blank", () => {
        const css = getInteractiveStyles();
        assert.ok(css.includes(".line.line-blank"), "export CSS must define .line.line-blank");
        assert.ok(css.includes("0.25") && css.includes("--export-line-height"), "export blank rows use quarter of line-height token");
    });

    test("simple static HTML export styles include per-line line-blank quarter rule", () => {
        const css = getSimpleHtmlExportStyles();
        assert.ok(css.includes("#log-content .line.line-blank"), "simple export must use .line.line-blank under #log-content");
        assert.ok(css.includes("0.25") && css.includes("--export-line-height"), "simple export blank rows use quarter height token");
    });
});
