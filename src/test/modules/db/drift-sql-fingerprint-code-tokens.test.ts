import * as assert from "node:assert";
import { extractDriftFingerprintSearchTokens } from "../../../modules/db/drift-sql-fingerprint-code-tokens";

suite("extractDriftFingerprintSearchTokens", () => {
  test("returns [] for empty", () => {
    assert.deepStrictEqual(extractDriftFingerprintSearchTokens(""), []);
  });

  test("skips stopwords, placeholders, and short tokens", () => {
    const t = extractDriftFingerprintSearchTokens("select * from users where id = ?");
    assert.ok(t.includes("users"));
    assert.ok(!t.includes("select"));
    assert.ok(!t.includes("from"));
    assert.ok(!t.includes("where"));
  });

  test("dedupes and caps length", () => {
    const long = Array.from({ length: 20 }, (_, i) => `t${i}`).join(" ");
    const out = extractDriftFingerprintSearchTokens(long);
    assert.strictEqual(out.length, 12);
    assert.strictEqual(new Set(out).size, 12);
  });

  test("all-stopwords fingerprint yields no tokens (avoid indexer noise)", () => {
    assert.deepStrictEqual(
      extractDriftFingerprintSearchTokens("select from where and or join on"),
      [],
    );
  });

  test("skips numeric-only tokens and ? placeholders", () => {
    const out = extractDriftFingerprintSearchTokens("? 12 3.14 users 99");
    assert.deepStrictEqual(out, ["users"]);
  });

  test("does not treat SQL-looking drift as table names when only keywords", () => {
    assert.deepStrictEqual(extractDriftFingerprintSearchTokens("inner outer cross"), []);
  });
});
