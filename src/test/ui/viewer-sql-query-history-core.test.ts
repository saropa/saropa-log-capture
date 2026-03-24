import * as assert from 'assert';
import {
    getSqlQueryHistoryCoreScript,
    getSqlQueryHistoryRuntimeScript,
    SQL_QUERY_HISTORY_MAX_FP,
} from '../../ui/viewer-stack-tags/viewer-sql-query-history-core';

suite('viewer-sql-query-history-core', () => {
    test('exports cap constant in documented range', () => {
        assert.ok(SQL_QUERY_HISTORY_MAX_FP >= 100 && SQL_QUERY_HISTORY_MAX_FP <= 5000);
    });

    test('core script wires lifecycle helpers and cap', () => {
        const s = getSqlQueryHistoryCoreScript();
        assert.ok(s.includes('rebuildSqlQueryHistoryFromAllLines'));
        assert.ok(s.includes('recordSqlQueryHistoryForAppendedItem'));
        assert.ok(s.includes('resetSqlQueryHistory'));
        assert.ok(s.includes('finalizeSqlPatternState'));
        assert.ok(s.includes(`SQL_QUERY_HISTORY_MAX_FP = ${SQL_QUERY_HISTORY_MAX_FP}`));
    });

    test('runtime script is embeddable without lifecycle wrap for tests', () => {
        const r = getSqlQueryHistoryRuntimeScript();
        assert.ok(r.includes('function rebuildSqlQueryHistoryFromAllLines'));
        assert.ok(!r.includes('wrapSqlPatternLifecycleForQueryHistory'));
    });

    test('parameterized runtime injects alternate cap', () => {
        const r = getSqlQueryHistoryRuntimeScript(7);
        assert.ok(r.includes('SQL_QUERY_HISTORY_MAX_FP = 7'));
    });
});
