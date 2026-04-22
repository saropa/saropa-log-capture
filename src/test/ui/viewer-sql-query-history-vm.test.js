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
/**
 * DB_11 test plan: VM runs the same embedded runtime as the webview (add/trim/clear, same-fp,
 * empty session, hidden-line rule, LRU cap, ingest throughput smoke).
 */
const assert = __importStar(require("node:assert"));
const vm = __importStar(require("node:vm"));
const viewer_sql_query_history_core_1 = require("../../ui/viewer-stack-tags/viewer-sql-query-history-core");
function loadRuntime(allLines, maxFp) {
    const context = vm.createContext({ allLines });
    vm.runInContext((0, viewer_sql_query_history_core_1.getSqlQueryHistoryRuntimeScript)(maxFp ?? viewer_sql_query_history_core_1.SQL_QUERY_HISTORY_MAX_FP), context, { timeout: 15_000 });
    return context;
}
function dbLine(fp, ts, extra = {}) {
    return {
        type: 'line',
        sourceTag: 'database',
        height: 20,
        timestamp: ts,
        dbSignal: { fingerprint: fp, sqlSnippet: `SELECT ${fp}` },
        ...extra,
    };
}
suite('viewer-sql-query-history VM (DB_11)', () => {
    test('rebuild after simulated trim keeps first/last indices consistent with allLines', () => {
        const ctx = loadRuntime([
            dbLine('sameFp', 1),
            dbLine('sameFp', 2),
            dbLine('other', 3),
        ]);
        ctx.rebuildSqlQueryHistoryFromAllLines();
        assert.strictEqual(ctx.sqlQueryHistoryByFp.sameFp.count, 2);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.sameFp.firstIdx, 0);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.sameFp.lastIdx, 1);
        /* Drop first row like trimData splice(0,1). */
        ctx.allLines.splice(0, 1);
        ctx.rebuildSqlQueryHistoryFromAllLines();
        assert.strictEqual(ctx.sqlQueryHistoryByFp.sameFp.count, 1);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.sameFp.firstIdx, 0);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.sameFp.lastIdx, 0);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.other.firstIdx, 1);
    });
    test('resetSqlQueryHistory empties the index (session clear)', () => {
        const ctx = loadRuntime([dbLine('x', 1)]);
        ctx.rebuildSqlQueryHistoryFromAllLines();
        assert.ok(ctx.sqlQueryHistoryByFp.x);
        ctx.resetSqlQueryHistory();
        /* Cross-realm: VM object is not deepStrictEqual to host `{}` after createContext change. */
        assert.strictEqual(Object.keys(ctx.sqlQueryHistoryByFp).length, 0);
    });
    test('sampleSql keeps raw sqlSnippet (quoted table names) for display', () => {
        const ctx = loadRuntime([
            dbLine("fp1", 10, {
                dbSignal: { fingerprint: "fp1", sqlSnippet: 'SELECT * FROM "contacts" WHERE id = 1' },
            }),
        ]);
        ctx.rebuildSqlQueryHistoryFromAllLines();
        assert.strictEqual(ctx.sqlQueryHistoryByFp.fp1.sampleSql, 'SELECT * FROM "contacts" WHERE id = 1');
    });
    test('many rows with the same fingerprint update count and first/last line refs', () => {
        const ctx = loadRuntime([
            dbLine('fpA', 10),
            dbLine('fpA', 20),
            dbLine('fpA', 30),
        ]);
        ctx.rebuildSqlQueryHistoryFromAllLines();
        const e = ctx.sqlQueryHistoryByFp.fpA;
        assert.strictEqual(e.count, 3);
        assert.strictEqual(e.firstIdx, 0);
        assert.strictEqual(e.lastIdx, 2);
        assert.strictEqual(e.lastSeen, 30);
    });
    test('empty allLines and no-SQL lines yield empty index (no throw)', () => {
        const empty = loadRuntime([]);
        empty.rebuildSqlQueryHistoryFromAllLines();
        assert.strictEqual(Object.keys(empty.sqlQueryHistoryByFp).length, 0);
        const noSql = loadRuntime([
            { type: 'line', sourceTag: 'network', height: 20, timestamp: 1 },
            { type: 'marker', height: 8 },
        ]);
        noSql.rebuildSqlQueryHistoryFromAllLines();
        assert.strictEqual(Object.keys(noSql.sqlQueryHistoryByFp).length, 0);
    });
    test('jump target: sqlHistoryTargetLineLikelyHidden delegates to calcItemHeight', () => {
        /* Inject a stub calcItemHeight into the sandbox to verify delegation. */
        const lines = [
            { type: 'line', sourceTag: 'database', height: 20, timestamp: 1, dbSignal: { fingerprint: 'f' } },
        ];
        const context = vm.createContext({
            allLines: lines,
            calcItemHeight: (it) => it.height,
        });
        vm.runInContext((0, viewer_sql_query_history_core_1.getSqlQueryHistoryRuntimeScript)(), context, { timeout: 15_000 });
        const ctx = context;
        /* Visible line: calcItemHeight returns 20. */
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(0), false);
        /* Hidden line: calcItemHeight returns 0. */
        lines[0] = { type: 'line', sourceTag: 'database', height: 0, timestamp: 1 };
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(0), true);
        /* Out-of-range index: always hidden. */
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(99), true);
    });
    test('jump target: falls back to height check when calcItemHeight unavailable', () => {
        /* No calcItemHeight injected — fallback path. */
        const ctx = loadRuntime([
            { type: 'line', sourceTag: 'database', height: 20, timestamp: 1 },
        ]);
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(0), false);
        ctx.allLines[0] = { type: 'line', sourceTag: 'database', height: 0, timestamp: 1 };
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(0), true);
    });
    test('recordSqlQueryHistoryForAppendedItem uses tail index after push', () => {
        const ctx = loadRuntime([]);
        const item = dbLine('tailFp', 99);
        ctx.allLines.push(item);
        ctx.recordSqlQueryHistoryForAppendedItem(item);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.tailFp.firstIdx, 0);
        ctx.allLines.push(dbLine('tailFp', 100));
        ctx.recordSqlQueryHistoryForAppendedItem(ctx.allLines[1]);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.tailFp.count, 2);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.tailFp.lastIdx, 1);
    });
    test('LRU eviction when over cap (small cap via test-only runtime)', () => {
        const ctx = loadRuntime([], 3);
        ctx.recordSqlQueryHistoryObservation({ fp: 'a', lineIdx: 0, ts: 1, preview: 'p' });
        ctx.recordSqlQueryHistoryObservation({ fp: 'b', lineIdx: 1, ts: 2, preview: 'p' });
        ctx.recordSqlQueryHistoryObservation({ fp: 'c', lineIdx: 2, ts: 3, preview: 'p' });
        assert.strictEqual(Object.keys(ctx.sqlQueryHistoryByFp).length, 3);
        ctx.recordSqlQueryHistoryObservation({ fp: 'd', lineIdx: 3, ts: 4, preview: 'p' });
        assert.strictEqual(Object.keys(ctx.sqlQueryHistoryByFp).length, 3);
        assert.strictEqual(ctx.sqlQueryHistoryByFp.a, undefined);
        assert.ok(ctx.sqlQueryHistoryByFp.d);
        assert.ok(ctx.sqlQueryHistoryByFp.b);
        assert.ok(ctx.sqlQueryHistoryByFp.c);
    });
    test('regression smoke: many observations on one fingerprint stay fast', () => {
        const ctx = loadRuntime([]);
        const n = 25_000;
        const t0 = Date.now();
        for (let i = 0; i < n; i++) {
            ctx.recordSqlQueryHistoryObservation({ fp: 'oneFp', lineIdx: i, ts: i, preview: 'preview' });
        }
        const ms = Date.now() - t0;
        assert.strictEqual(ctx.sqlQueryHistoryByFp.oneFp.count, n);
        assert.ok(ms < 12_000, `expected ${n} incremental observations in under 12s (took ${ms}ms)`);
    });
    test('max duration aggregates on merge and rebuild', () => {
        const ctx = loadRuntime([
            { ...dbLine('slow', 1), elapsedMs: 5 },
            { ...dbLine('slow', 2), elapsedMs: 40 },
            { ...dbLine('slow', 3), elapsedMs: 12 },
        ]);
        ctx.rebuildSqlQueryHistoryFromAllLines();
        assert.strictEqual(ctx.sqlQueryHistoryByFp.slow.maxDur, 40);
    });
});
//# sourceMappingURL=viewer-sql-query-history-vm.test.js.map