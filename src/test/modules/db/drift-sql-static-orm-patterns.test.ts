import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  buildDriftStaticSqlSearchPlan,
  DRIFT_STATIC_ORM_PATTERN_ROWS,
  fingerprintHasWord,
  tableTokenToDartClassHints,
} from "../../../modules/db/drift-sql-static-orm-patterns";

describe("buildDriftStaticSqlSearchPlan", () => {
  it("select + table adds read-shaped drift tokens", () => {
    const plan = buildDriftStaticSqlSearchPlan("select * from orders where id = ?");
    assert.ok(plan.indexerTokens.includes("orders"));
    assert.ok(plan.indexerTokens.includes("watch") || plan.indexerTokens.includes("getsingle"));
    assert.strictEqual(plan.primaryTableToken, "orders");
    assert.deepStrictEqual(plan.dartClassHints, ["Orders"]);
  });

  it("insert adds companion and into", () => {
    const plan = buildDriftStaticSqlSearchPlan("insert into users values ?");
    assert.ok(plan.indexerTokens.includes("users"));
    assert.ok(plan.indexerTokens.includes("companion"));
    assert.ok(plan.indexerTokens.includes("into"));
  });

  it("select with join adds join API tokens", () => {
    const plan = buildDriftStaticSqlSearchPlan("select * from a join b on a.id = b.id");
    assert.ok(plan.indexerTokens.includes("innerjoin") || plan.indexerTokens.includes("leftjoin"));
  });

  it("snake_case table maps to PascalCase hint", () => {
    const plan = buildDriftStaticSqlSearchPlan("select * from user_profiles where id = ?");
    assert.deepStrictEqual(plan.dartClassHints, ["UserProfiles"]);
  });
});

describe("fingerprintHasWord", () => {
  it("matches whole word only", () => {
    assert.ok(fingerprintHasWord("delete from orders where id = ?", "delete"));
    assert.ok(!fingerprintHasWord("select * from orders", "delete"));
  });
});

describe("DRIFT_STATIC_ORM_PATTERN_ROWS", () => {
  it("every row has non-empty id and rationale", () => {
    for (const row of DRIFT_STATIC_ORM_PATTERN_ROWS) {
      assert.ok(row.id.length > 0);
      assert.ok(row.rationale.length > 0);
      assert.ok(row.fingerprintWordsAll.length > 0);
    }
  });
});

describe("tableTokenToDartClassHints", () => {
  it("underscore segments become PascalCase", () => {
    assert.deepStrictEqual(tableTokenToDartClassHints("foo_bar"), ["FooBar"]);
  });
});
