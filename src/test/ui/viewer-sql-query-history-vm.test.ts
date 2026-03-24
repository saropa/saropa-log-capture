/**
 * DB_11 test plan: VM runs the same embedded runtime as the webview (add/trim/clear, same-fp,
 * empty session, hidden-line rule, LRU cap, ingest throughput smoke).
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import {
    getSqlQueryHistoryRuntimeScript,
    SQL_QUERY_HISTORY_MAX_FP,
} from '../../ui/viewer-stack-tags/viewer-sql-query-history-core';

type SqlHistoryEntry = {
    count: number;
    firstIdx: number;
    lastIdx: number;
    lastSeen: number;
    preview: string;
    maxDur?: number;
};

interface HistorySandbox {
    allLines: unknown[];
    sqlQueryHistoryByFp: Record<string, SqlHistoryEntry>;
    rebuildSqlQueryHistoryFromAllLines: () => void;
    resetSqlQueryHistory: () => void;
    recordSqlQueryHistoryObservation: (
        fp: string,
        lineIdx: number,
        ts: number,
        preview: string,
        dur?: number,
    ) => void;
    recordSqlQueryHistoryForAppendedItem: (item: unknown) => void;
    sqlHistoryTargetLineLikelyHidden: (idx: number) => boolean;
}

function loadRuntime(allLines: unknown[], maxFp?: number): HistorySandbox {
    const context = vm.createContext({ allLines });
    vm.runInContext(getSqlQueryHistoryRuntimeScript(maxFp ?? SQL_QUERY_HISTORY_MAX_FP), context, { timeout: 15_000 });
    return context as unknown as HistorySandbox;
}

function dbLine(fp: string, ts: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        type: 'line',
        sourceTag: 'database',
        height: 20,
        timestamp: ts,
        dbInsight: { fingerprint: fp, sqlSnippet: `SELECT ${fp}` },
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

    test('jump target: sqlHistoryTargetLineLikelyHidden matches filter / height contract', () => {
        const ctx = loadRuntime([
            { type: 'line', sourceTag: 'database', height: 20, timestamp: 1, dbInsight: { fingerprint: 'f' } },
        ]);
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(0), false);

        ctx.allLines[0] = {
            type: 'line',
            sourceTag: 'database',
            height: 20,
            timestamp: 1,
            dbInsight: { fingerprint: 'f' },
            sqlPatternFiltered: true,
        };
        assert.strictEqual(ctx.sqlHistoryTargetLineLikelyHidden(0), true);

        ctx.allLines[0] = {
            type: 'line',
            sourceTag: 'database',
            height: 0,
            timestamp: 1,
            dbInsight: { fingerprint: 'f' },
        };
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
        ctx.recordSqlQueryHistoryObservation('a', 0, 1, 'p', undefined);
        ctx.recordSqlQueryHistoryObservation('b', 1, 2, 'p', undefined);
        ctx.recordSqlQueryHistoryObservation('c', 2, 3, 'p', undefined);
        assert.strictEqual(Object.keys(ctx.sqlQueryHistoryByFp).length, 3);
        ctx.recordSqlQueryHistoryObservation('d', 3, 4, 'p', undefined);
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
            ctx.recordSqlQueryHistoryObservation('oneFp', i, i, 'preview', undefined);
        }
        const ms = Date.now() - t0;
        assert.strictEqual(ctx.sqlQueryHistoryByFp.oneFp.count, n);
        assert.ok(
            ms < 12_000,
            `expected ${n} incremental observations in under 12s (took ${ms}ms)`,
        );
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
