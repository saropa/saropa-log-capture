import * as assert from 'node:assert';
import { getScrollbarMinimapScript } from '../../ui/viewer/viewer-scrollbar-minimap';
import {
    isMinimapSlowSqlDensityLine,
    isMinimapSqlDensityLine,
    minimapSqlDensityBucketIndex,
    MINIMAP_SQL_KEYWORD_RE
} from '../../ui/viewer/viewer-scrollbar-minimap-sql-heuristics';

suite('viewer-scrollbar-minimap-sql-heuristics', () => {
    suite('isMinimapSqlDensityLine', () => {
        test('database sourceTag counts without keywords', () => {
            assert.strictEqual(isMinimapSqlDensityLine('database', 'hello'), true);
        });

        test('empty plain and non-database tag does not count', () => {
            assert.strictEqual(isMinimapSqlDensityLine(undefined, ''), false);
            assert.strictEqual(isMinimapSqlDensityLine('terminal', ''), false);
        });

        test('keyword match counts', () => {
            assert.strictEqual(isMinimapSqlDensityLine(undefined, 'SELECT * FROM t'), true);
            assert.strictEqual(isMinimapSqlDensityLine(null, 'pragma journal_mode'), true);
        });

        test('false positive: substring "selection" must not match SELECT token', () => {
            assert.strictEqual(isMinimapSqlDensityLine(undefined, 'User selection changed'), false);
        });

        test('false positive: unrelated "insert" as substring of longer token', () => {
            assert.strictEqual(MINIMAP_SQL_KEYWORD_RE.test('reinserted'), false);
        });
    });

    suite('isMinimapSlowSqlDensityLine', () => {
        test('performance level on SQL line counts as slow channel', () => {
            assert.strictEqual(isMinimapSlowSqlDensityLine('performance', 'SELECT 1', 'database'), true);
        });

        test('slow query text after SQL classification counts', () => {
            assert.strictEqual(isMinimapSlowSqlDensityLine('info', 'Slow query: SELECT 1'), true);
        });

        test('before: slow text alone without SQL must not count (false positive guard)', () => {
            assert.strictEqual(isMinimapSlowSqlDensityLine('warning', 'Slow query timeout'), false);
        });

        test('after: slow text with keyword counts', () => {
            assert.strictEqual(isMinimapSlowSqlDensityLine('warning', 'Slow query: SELECT 1'), true);
        });
    });

    suite('minimapSqlDensityBucketIndex', () => {
        test('py 0 maps to bucket 0', () => {
            assert.strictEqual(minimapSqlDensityBucketIndex(0, 100, 10), 0);
        });

        test('top pixel maps to last bucket', () => {
            assert.strictEqual(minimapSqlDensityBucketIndex(99, 100, 10), 9);
        });

        test('mmH zero uses minimum divisor 1 (no NaN / invalid bucket)', () => {
            assert.strictEqual(minimapSqlDensityBucketIndex(0, 0, 5), 0);
        });
    });

    suite('injected script stays aligned with heuristics module', () => {
        test('minimap script embeds the same SQL keyword pattern source', () => {
            const script = getScrollbarMinimapScript();
            assert.ok(
                script.includes(MINIMAP_SQL_KEYWORD_RE.toString()),
                'injected script should embed MINIMAP_SQL_KEYWORD_RE via .toString()'
            );
        });
    });
});
