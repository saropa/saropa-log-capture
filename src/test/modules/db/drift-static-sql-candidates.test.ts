import * as assert from "node:assert";
import { describe, it } from "node:test";
import { buildDriftStaticSqlSearchPlan } from "../../../modules/db/drift-sql-static-orm-patterns";
import {
  scoreFileContentForStaticSql,
  type EnrichedStaticSqlCandidate,
} from "../../../modules/db/drift-static-sql-candidates";

describe("scoreFileContentForStaticSql", () => {
  it("ranks line with table + query tokens above token-only noise file", () => {
    const plan = buildDriftStaticSqlSearchPlan("select * from orders where id = ?");
    const noise = "// misc\nvoid foo() {\n  var x = unrelated;\n}\n";
    const queryFile = `
import 'package:drift/drift.dart';

Stream<Orders> watchOrders() {
  return (select(db.orders)..where((t) => t.id.equals(1))).watch();
}
`;
    const noiseScore = scoreFileContentForStaticSql(plan, noise);
    const queryScore = scoreFileContentForStaticSql(plan, queryFile);
    assert.ok(!noiseScore.lineHasPrimaryTableShape || queryScore.lineHasPrimaryTableShape);
    assert.ok(
      queryScore.lineHasPrimaryTableShape
        || queryScore.bestLineTokenHits > noiseScore.bestLineTokenHits,
      "query file should beat noise on table shape or token density",
    );
  });

  it("prefers earlier line on tie", () => {
    const plan = buildDriftStaticSqlSearchPlan("select id from items");
    const content = "line a items\nline b items\n";
    const s = scoreFileContentForStaticSql(plan, content);
    assert.strictEqual(s.bestLine1Based, 1);
  });
});

describe("static SQL candidate sort key (fixture)", () => {
  it("table-shaped candidate sorts before file-only at same indexer score", () => {
    const withTable: EnrichedStaticSqlCandidate = {
      doc: {
        relativePath: "lib/a.dart",
        uri: "file:///a.dart",
        sizeBytes: 1,
        mtime: 1,
        lineCount: 10,
        tokens: [],
        headings: [],
      },
      indexerScore: 10,
      bestLine1Based: 3,
      lineHasPrimaryTableShape: true,
      bestLineTokenHits: 2,
      isDartFile: true,
    };
    const fileOnly: EnrichedStaticSqlCandidate = {
      doc: {
        relativePath: "lib/b.dart",
        uri: "file:///b.dart",
        sizeBytes: 1,
        mtime: 1,
        lineCount: 10,
        tokens: [],
        headings: [],
      },
      indexerScore: 10,
      bestLine1Based: 1,
      lineHasPrimaryTableShape: false,
      bestLineTokenHits: 3,
      isDartFile: true,
    };
    const sorted = [fileOnly, withTable].sort((a, b) => {
      if (a.lineHasPrimaryTableShape !== b.lineHasPrimaryTableShape) {
        return a.lineHasPrimaryTableShape ? -1 : 1;
      }
      if (a.bestLineTokenHits !== b.bestLineTokenHits) {
        return b.bestLineTokenHits - a.bestLineTokenHits;
      }
      if (a.indexerScore !== b.indexerScore) {
        return b.indexerScore - a.indexerScore;
      }
      if (a.isDartFile !== b.isDartFile) {
        return a.isDartFile ? -1 : 1;
      }
      return a.doc.relativePath.localeCompare(b.doc.relativePath);
    });
    assert.strictEqual(sorted[0].doc.relativePath, "lib/a.dart");
  });
});
