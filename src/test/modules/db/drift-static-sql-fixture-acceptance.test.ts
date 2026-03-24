import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildDriftStaticSqlSearchPlan } from "../../../modules/db/drift-sql-static-orm-patterns";
import { buildEnrichedStaticSqlPickListSync, filterRankedDocsByStaticSqlPathGlobs } from "../../../modules/db/drift-static-sql-candidates";
import { extractDocTokensByType } from "../../../modules/project-indexer/project-indexer-file-types";
import type { DocIndexEntry } from "../../../modules/project-indexer/project-indexer-types";
import { rankDocEntriesByQueriesWithScores, type RankedDocEntry } from "../../../modules/project-indexer/project-indexer-ranking";

const FIXTURE_FP = "select * from orders where id = ?";

/** Compiled tests live under `out/test/...`; fixtures stay in `src/test/fixtures`. */
function resolveFixtureRoot(): string {
  const repoRoot = path.join(__dirname, "../../../..");
  return path.join(repoRoot, "src/test/fixtures/drift-static-sql-mini");
}

function readFixture(rel: string): string {
  return fs.readFileSync(path.join(resolveFixtureRoot(), rel), "utf-8");
}

function docFromFixture(relPosix: string, content: string): DocIndexEntry {
  const ext = path.posix.extname(relPosix) || ".dart";
  const lowerPath = relPosix.toLowerCase();
  const { tokens, headings } = extractDocTokensByType(content, ext, lowerPath);
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
    const plan = buildDriftStaticSqlSearchPlan(FIXTURE_FP);
    assert.ok(plan.pathGlobPatterns.includes("**/*.dart"), "plan should include dart glob");
    const ordersContent = readFixture("lib/intentional_orders_query.dart");
    const noiseContent = readFixture("lib/noise_utils.dart");
    const docs = [
      docFromFixture("lib/noise_utils.dart", noiseContent),
      docFromFixture("lib/intentional_orders_query.dart", ordersContent),
    ];
    const ranked = rankDocEntriesByQueriesWithScores(docs, [...plan.indexerTokens]);
    assert.ok(ranked.length >= 1, "indexer should return at least one hit");
    const contents = new Map<string, string>([
      ["lib/noise_utils.dart", noiseContent],
      ["lib/intentional_orders_query.dart", ordersContent],
    ]);
    const picks = buildEnrichedStaticSqlPickListSync(plan, ranked, contents, 10);
    const top3 = picks.slice(0, 3).map((p) => p.doc.relativePath);
    assert.ok(
      top3.some((p) => p.includes("intentional_orders_query")),
      `expected intentional_orders_query in top 3, got: ${top3.join(", ")}`,
    );
  });

  test("path glob filter drops non-matching paths before enrichment", () => {
    const plan = buildDriftStaticSqlSearchPlan(FIXTURE_FP);
    const noise = docFromFixture("lib/noise_utils.dart", "x");
    const readme: DocIndexEntry = {
      ...noise,
      relativePath: "README.md",
      uri: "file:///fixture/README.md",
    };
    const ranked: RankedDocEntry[] = [
      { doc: readme, score: 999 },
      { doc: noise, score: 1 },
    ];
    const filtered = filterRankedDocsByStaticSqlPathGlobs(ranked, plan.pathGlobPatterns);
    assert.ok(filtered.every((r) => r.doc.relativePath.endsWith(".dart")));
    assert.strictEqual(filtered.length, 1);
  });
});
