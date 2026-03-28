import * as assert from "node:assert";
import {
    ansiLinkifyLineHtml,
    buildDriftArgsFoldHtml,
    buildLogLineHtmlWithOptionalDriftArgsFold,
    trySplitDriftSqlArgsSuffix,
} from "../../../modules/db/drift-log-line-args-fold";

suite("drift-log-line-args-fold", () => {
    test("trySplitDriftSqlArgsSuffix splits on last with args in Drift: Sent body", () => {
        const raw =
            'I/flutter: Drift: Sent PRAGMA foreign_key_list("connections") with args []';
        const sp = trySplitDriftSqlArgsSuffix(raw);
        if (!sp) {
            assert.fail("expected split");
        }
        assert.strictEqual(
            sp.prefix,
            'I/flutter: Drift: Sent PRAGMA foreign_key_list("connections")',
        );
        assert.strictEqual(sp.suffix, " with args []");
    });

    test("trySplitDriftSqlArgsSuffix returns null without Drift: Sent", () => {
        assert.strictEqual(trySplitDriftSqlArgsSuffix("SELECT 1 with args []"), null);
    });

    test("buildDriftArgsFoldHtml encodes suffix in title and body", () => {
        const h = buildDriftArgsFoldHtml(" with args []");
        assert.ok(h.includes('title=" with args []"'));
        assert.ok(h.includes("drift-args-fold-btn"));
        assert.ok(h.includes(" with args []"));
    });

    test("buildLogLineHtmlWithOptionalDriftArgsFold embeds fold between ansi segments", () => {
        const raw = 'Drift: Sent SELECT 1 with args [1]';
        const html = buildLogLineHtmlWithOptionalDriftArgsFold(raw);
        assert.ok(html.includes("drift-args-fold"));
        assert.ok(html.includes("[1]"));
        assert.ok(html.includes("SELECT 1") || html.includes("SELECT"));
    });

    test("should render suffix exactly once, inside fold wrapper only", () => {
        const raw = 'Drift: Sent PRAGMA table_info("x") with args []';
        const html = buildLogLineHtmlWithOptionalDriftArgsFold(raw);
        // The suffix must appear inside .drift-args-suffix (hidden until expanded)
        assert.ok(html.includes('<span class="drift-args-suffix"> with args []</span>'));
        // After the closing </span></span> of the fold wrapper, no second copy should exist
        const foldEnd = html.indexOf('</span></span>');
        assert.ok(foldEnd >= 0, "expected fold wrapper close tags");
        const afterFold = html.substring(foldEnd + '</span></span>'.length);
        assert.strictEqual(
            afterFold.includes("with args"),
            false,
            "suffix must not appear after fold wrapper (was rendered twice before fix)",
        );
    });

    test("should render non-empty args inside fold wrapper", () => {
        const raw = 'Drift: Sent SELECT * FROM t WHERE id = ? with args [42]';
        const html = buildLogLineHtmlWithOptionalDriftArgsFold(raw);
        assert.ok(html.includes('<span class="drift-args-suffix"> with args [42]</span>'));
        const foldEnd = html.indexOf('</span></span>');
        const afterFold = html.substring(foldEnd + '</span></span>'.length);
        assert.strictEqual(
            afterFold.includes("with args"),
            false,
            "non-empty args suffix must not appear after fold wrapper",
        );
    });

    test("non-Drift lines match plain ansiLinkify path", () => {
        const plain = "hello world";
        assert.strictEqual(
            buildLogLineHtmlWithOptionalDriftArgsFold(plain),
            ansiLinkifyLineHtml(plain),
        );
    });
});
