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
const drift_static_sql_candidates_1 = require("../../../modules/db/drift-static-sql-candidates");
(0, node_test_1.describe)("scoreFileContentForStaticSql", () => {
    (0, node_test_1.it)("ranks line with table + query tokens above token-only noise file", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)("select * from orders where id = ?");
        const noise = "// misc\nvoid foo() {\n  var x = unrelated;\n}\n";
        const queryFile = `
import 'package:drift/drift.dart';

Stream<Orders> watchOrders() {
  return (select(db.orders)..where((t) => t.id.equals(1))).watch();
}
`;
        const noiseScore = (0, drift_static_sql_candidates_1.scoreFileContentForStaticSql)(plan, noise);
        const queryScore = (0, drift_static_sql_candidates_1.scoreFileContentForStaticSql)(plan, queryFile);
        assert.ok(!noiseScore.lineHasPrimaryTableShape || queryScore.lineHasPrimaryTableShape);
        assert.ok(queryScore.lineHasPrimaryTableShape
            || queryScore.bestLineTokenHits > noiseScore.bestLineTokenHits, "query file should beat noise on table shape or token density");
    });
    (0, node_test_1.it)("prefers earlier line on tie", () => {
        const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)("select id from items");
        const content = "line a items\nline b items\n";
        const s = (0, drift_static_sql_candidates_1.scoreFileContentForStaticSql)(plan, content);
        assert.strictEqual(s.bestLine1Based, 1);
    });
});
(0, node_test_1.describe)("static SQL candidate sort key (fixture)", () => {
    (0, node_test_1.it)("table-shaped candidate sorts before file-only at same indexer score", () => {
        const withTable = {
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
        const fileOnly = {
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
//# sourceMappingURL=drift-static-sql-candidates.test.js.map