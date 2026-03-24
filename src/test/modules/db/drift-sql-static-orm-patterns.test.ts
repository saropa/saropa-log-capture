import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  buildDriftStaticSqlSearchPlan,
  DRIFT_STATIC_ORM_PATTERN_ROWS,
  fingerprintHasWord,
  pathMatchesStaticSqlGlob,
  tableTokenToDartClassHints,
} from "../../../modules/db/drift-sql-static-orm-patterns";

describe("buildDriftStaticSqlSearchPlan", () => {
  it("select + table adds read-shaped drift tokens", () => {
    const plan = buildDriftStaticSqlSearchPlan("select * from orders where id = ?");
    assert.ok(plan.indexerTokens.includes("orders"));
    assert.ok(plan.indexerTokens.includes("watch") || plan.indexerTokens.includes("getsingle"));
    assert.strictEqual(plan.primaryTableToken, "orders");
    assert.deepStrictEqual(plan.dartClassHints, ["Orders"]);
    assert.ok(plan.pathGlobPatterns.includes("**/*.dart"));
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

describe("pathMatchesStaticSqlGlob", () => {
  it("matches **/*.dart suffix", () => {
    assert.ok(pathMatchesStaticSqlGlob("lib/foo.dart", "**/*.dart"));
    assert.ok(pathMatchesStaticSqlGlob("pkg\\src\\x.DART", "**/*.dart"));
    assert.ok(!pathMatchesStaticSqlGlob("lib/foo.ts", "**/*.dart"));
  });
  it("matches lib/** prefix", () => {
    assert.ok(pathMatchesStaticSqlGlob("lib/a.dart", "lib/**"));
    assert.ok(!pathMatchesStaticSqlGlob("test/lib/a.dart", "lib/**"));
  });
});
