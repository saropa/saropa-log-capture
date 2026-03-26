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
const assert = __importStar(require("node:assert"));
const node_test_1 = require("node:test");
const drift_sql_static_orm_patterns_1 = require("../../../modules/db/drift-sql-static-orm-patterns");
(0, node_test_1.describe)("buildDriftStaticSqlSearchPlan", () => {
    (0, node_test_1.it)("select + table adds read-shaped drift tokens", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)("select * from orders where id = ?");
        assert.ok(plan.indexerTokens.includes("orders"));
        assert.ok(plan.indexerTokens.includes("watch") || plan.indexerTokens.includes("getsingle"));
        assert.strictEqual(plan.primaryTableToken, "orders");
        assert.deepStrictEqual(plan.dartClassHints, ["Orders"]);
        assert.ok(plan.pathGlobPatterns.includes("**/*.dart"));
    });
    (0, node_test_1.it)("insert adds companion and into", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)("insert into users values ?");
        assert.ok(plan.indexerTokens.includes("users"));
        assert.ok(plan.indexerTokens.includes("companion"));
        assert.ok(plan.indexerTokens.includes("into"));
    });
    (0, node_test_1.it)("select with join adds join API tokens", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)("select * from a join b on a.id = b.id");
        assert.ok(plan.indexerTokens.includes("innerjoin") || plan.indexerTokens.includes("leftjoin"));
    });
    (0, node_test_1.it)("snake_case table maps to PascalCase hint", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)("select * from user_profiles where id = ?");
        assert.deepStrictEqual(plan.dartClassHints, ["UserProfiles"]);
    });
});
(0, node_test_1.describe)("fingerprintHasWord", () => {
    (0, node_test_1.it)("matches whole word only", () => {
        assert.ok((0, drift_sql_static_orm_patterns_1.fingerprintHasWord)("delete from orders where id = ?", "delete"));
        assert.ok(!(0, drift_sql_static_orm_patterns_1.fingerprintHasWord)("select * from orders", "delete"));
    });
});
(0, node_test_1.describe)("DRIFT_STATIC_ORM_PATTERN_ROWS", () => {
    (0, node_test_1.it)("every row has non-empty id and rationale", () => {
        for (const row of drift_sql_static_orm_patterns_1.DRIFT_STATIC_ORM_PATTERN_ROWS) {
            assert.ok(row.id.length > 0);
            assert.ok(row.rationale.length > 0);
            assert.ok(row.fingerprintWordsAll.length > 0);
        }
    });
});
(0, node_test_1.describe)("tableTokenToDartClassHints", () => {
    (0, node_test_1.it)("underscore segments become PascalCase", () => {
        assert.deepStrictEqual((0, drift_sql_static_orm_patterns_1.tableTokenToDartClassHints)("foo_bar"), ["FooBar"]);
    });
});
(0, node_test_1.describe)("pathMatchesStaticSqlGlob", () => {
    (0, node_test_1.it)("matches **/*.dart suffix", () => {
        assert.ok((0, drift_sql_static_orm_patterns_1.pathMatchesStaticSqlGlob)("lib/foo.dart", "**/*.dart"));
        assert.ok((0, drift_sql_static_orm_patterns_1.pathMatchesStaticSqlGlob)("pkg\\src\\x.DART", "**/*.dart"));
        assert.ok(!(0, drift_sql_static_orm_patterns_1.pathMatchesStaticSqlGlob)("lib/foo.ts", "**/*.dart"));
    });
    (0, node_test_1.it)("matches lib/** prefix", () => {
        assert.ok((0, drift_sql_static_orm_patterns_1.pathMatchesStaticSqlGlob)("lib/a.dart", "lib/**"));
        assert.ok(!(0, drift_sql_static_orm_patterns_1.pathMatchesStaticSqlGlob)("test/lib/a.dart", "lib/**"));
    });
});
//# sourceMappingURL=drift-sql-static-orm-patterns.test.js.map