import * as assert from "node:assert";
import {
    ansiLinkifyLineHtml,
    buildDriftArgsDimHtml,
    buildLogLineHtmlWithOptionalDriftArgsDim,
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

    test("trySplitDriftSqlArgsSuffix splits DriftDebugInterceptor pipe-args format", () => {
        const raw =
            'Drift SELECT: SELECT * FROM "contacts" WHERE "id" = ?; | args: [42]';
        const sp = trySplitDriftSqlArgsSuffix(raw);
        if (!sp) {
            assert.fail("expected split for DriftDebugInterceptor format");
        }
        assert.strictEqual(
            sp.prefix,
            'Drift SELECT: SELECT * FROM "contacts" WHERE "id" = ?;',
        );
        assert.strictEqual(sp.suffix, " | args: [42]");
    });

    test("trySplitDriftSqlArgsSuffix splits DriftDebugInterceptor UPDATE format", () => {
        const raw =
            'Drift UPDATE: UPDATE "organizations" SET "version" = ? WHERE "id" = ?; | args: [null, 195]';
        const sp = trySplitDriftSqlArgsSuffix(raw);
        if (!sp) {
            assert.fail("expected split for DriftDebugInterceptor UPDATE");
        }
        assert.ok(sp.prefix.endsWith('?;'));
        assert.strictEqual(sp.suffix, " | args: [null, 195]");
    });

    test("buildDriftArgsDimHtml wraps suffix in dimmed span", () => {
        const h = buildDriftArgsDimHtml(" with args []");
        assert.ok(h.includes('class="drift-args-dim"'));
        assert.ok(h.includes(" with args []"));
    });

    test("buildLogLineHtmlWithOptionalDriftArgsDim dims args between ansi segments", () => {
        const raw = 'Drift: Sent SELECT 1 with args [1]';
        const html = buildLogLineHtmlWithOptionalDriftArgsDim(raw);
        assert.ok(html.includes("drift-args-dim"));
        assert.ok(html.includes("[1]"));
        assert.ok(html.includes("SELECT 1") || html.includes("SELECT"));
    });

    test("should render suffix exactly once, inside dim wrapper only", () => {
        const raw = 'Drift: Sent PRAGMA table_info("x") with args []';
        const html = buildLogLineHtmlWithOptionalDriftArgsDim(raw);
        assert.ok(html.includes('<span class="drift-args-dim"> with args []</span>'));
        const wrapEnd = html.indexOf('</span>', html.indexOf('drift-args-dim'));
        assert.ok(wrapEnd >= 0, "expected dim wrapper close tag");
        const afterWrap = html.substring(wrapEnd + '</span>'.length);
        assert.strictEqual(
            afterWrap.includes("with args"),
            false,
            "suffix must not appear after dim wrapper (was rendered twice before fix)",
        );
    });

    test("should render non-empty args inside dim wrapper", () => {
        const raw = 'Drift: Sent SELECT * FROM t WHERE id = ? with args [42]';
        const html = buildLogLineHtmlWithOptionalDriftArgsDim(raw);
        assert.ok(html.includes('<span class="drift-args-dim"> with args [42]</span>'));
    });

    test("non-Drift lines match plain ansiLinkify path", () => {
        const plain = "hello world";
        assert.strictEqual(
            buildLogLineHtmlWithOptionalDriftArgsDim(plain),
            ansiLinkifyLineHtml(plain),
        );
    });
});
