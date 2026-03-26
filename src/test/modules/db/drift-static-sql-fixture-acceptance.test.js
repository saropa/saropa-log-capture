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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const drift_sql_static_orm_patterns_1 = require("../../../modules/db/drift-sql-static-orm-patterns");
const drift_static_sql_candidates_1 = require("../../../modules/db/drift-static-sql-candidates");
const project_indexer_file_types_1 = require("../../../modules/project-indexer/project-indexer-file-types");
const project_indexer_ranking_1 = require("../../../modules/project-indexer/project-indexer-ranking");
const FIXTURE_FP = "select * from orders where id = ?";
/** Compiled tests live under `out/test/...`; fixtures stay in `src/test/fixtures`. */
function resolveFixtureRoot() {
    const repoRoot = path.join(__dirname, "../../../..");
    return path.join(repoRoot, "src/test/fixtures/drift-static-sql-mini");
}
function readFixture(rel) {
    return fs.readFileSync(path.join(resolveFixtureRoot(), rel), "utf-8");
}
function docFromFixture(relPosix, content) {
    const ext = path.posix.extname(relPosix) || ".dart";
    const lowerPath = relPosix.toLowerCase();
    const { tokens, headings } = (0, project_indexer_file_types_1.extractDocTokensByType)(content, ext, lowerPath);
    return {
        relativePath: relPosix,
        uri: `file:///fixture/${relPosix}`,
        sizeBytes: Buffer.byteLength(content, "utf-8"),
        mtime: 1,
        lineCount: content.split(/\r?\n/).length,
        tokens,
        headings,
    };
}
suite("DB_12 fixture acceptance (indexed + line ranking)", () => {
    test("intentional orders query file is in top 3 static candidates for fixture fingerprint", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)(FIXTURE_FP);
        assert.ok(plan.pathGlobPatterns.includes("**/*.dart"), "plan should include dart glob");
        const ordersContent = readFixture("lib/intentional_orders_query.dart");
        const noiseContent = readFixture("lib/noise_utils.dart");
        const docs = [
            docFromFixture("lib/noise_utils.dart", noiseContent),
            docFromFixture("lib/intentional_orders_query.dart", ordersContent),
        ];
        const ranked = (0, project_indexer_ranking_1.rankDocEntriesByQueriesWithScores)(docs, [...plan.indexerTokens]);
        assert.ok(ranked.length >= 1, "indexer should return at least one hit");
        const contents = new Map([
            ["lib/noise_utils.dart", noiseContent],
            ["lib/intentional_orders_query.dart", ordersContent],
        ]);
        const picks = (0, drift_static_sql_candidates_1.buildEnrichedStaticSqlPickListSync)(plan, ranked, contents, 10);
        const top3 = picks.slice(0, 3).map((p) => p.doc.relativePath);
        assert.ok(top3.some((p) => p.includes("intentional_orders_query")), `expected intentional_orders_query in top 3, got: ${top3.join(", ")}`);
    });
    test("path glob filter drops non-matching paths before enrichment", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)(FIXTURE_FP);
        const noise = docFromFixture("lib/noise_utils.dart", "x");
        const readme = {
            ...noise,
            relativePath: "README.md",
            uri: "file:///fixture/README.md",
        };
        const ranked = [
            { doc: readme, score: 999 },
            { doc: noise, score: 1 },
        ];
        const filtered = (0, drift_static_sql_candidates_1.filterRankedDocsByStaticSqlPathGlobs)(ranked, plan.pathGlobPatterns);
        assert.ok(filtered.every((r) => r.doc.relativePath.endsWith(".dart")));
        assert.strictEqual(filtered.length, 1);
    });
});
//# sourceMappingURL=drift-static-sql-fixture-acceptance.test.js.map