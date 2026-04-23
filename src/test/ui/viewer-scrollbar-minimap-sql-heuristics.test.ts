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

        test('minimap script includes proportional line width helpers', () => {
            const script = getScrollbarMinimapScript();
            assert.ok(script.includes('mmBarWidthFrac'), 'mmBarWidthFrac for VS Code–like bar width');
            assert.ok(script.includes('handleMinimapProportionalLines'), 'setting handler for minimapProportionalLines');
        });

        test('handleMinimapWidth maps all presets including xsmall and xlarge (px)', () => {
            const script = getScrollbarMinimapScript();
            assert.ok(script.includes('xsmall: 28') && script.includes('xlarge: 120'), 'narrow/wide presets');
            assert.ok(
                script.includes('small: 40') && script.includes('medium: 60') && script.includes('large: 90'),
                'legacy three presets unchanged',
            );
        });
    });

    suite('SQL density painting (scroll map vs editor minimap)', () => {
        test('sqlDensity color is pink (not blue) so bands read as annotation, not error', () => {
            const script = getScrollbarMinimapScript();
            assert.ok(
                script.includes("sqlDensity: 'rgba(200, 120, 180, 1)'"),
                'SQL density must use pink rgba(200,120,180) — blue was mistaken for selection highlights'
            );
        });

        test('after: paintSqlDensityBuckets uses full strip width (regression: no right-rail-only 0.42 fraction)', () => {
            const script = getScrollbarMinimapScript();
            const fn = script.split('function paintSqlDensityBuckets')[1];
            assert.ok(fn, 'paintSqlDensityBuckets present');
            const body = fn.split(/\nfunction |\nvar /)[0] ?? fn;
            assert.ok(
                body.includes('fillRect(0, y, mmW, bucketH)'),
                'SQL and slow-SQL bands must span full minimap width'
            );
            assert.ok(!body.includes('0.42'), 'old horizontal split fraction must not remain in this function');
        });
    });

    suite('neutral presence fallback (severity hidden / info-only)', () => {
        test('before: without neutral branch, info-only logs could paint nothing when info markers are off', () => {
            const script = getScrollbarMinimapScript();
            assert.ok(script.includes("(lv === 'info' || lv === 'debug' || lv === 'notice') && !mmShowInfo"), 'info/debug/notice skipped from severity groups when setting off');
        });

        test('after: paintMinimap collects a presence layer and paints it with neutral gray', () => {
            const script = getScrollbarMinimapScript();
            // Presence layer is now populated unconditionally for lines without a colored severity tick,
            // not gated on mc === 0 — so every visible line gets a mark and the minimap reads as a density map.
            assert.ok(script.includes('presence.push('), 'presence collection');
            assert.ok(script.includes('presence.length > 0'), 'presence paint guard');
            assert.ok(script.includes('rgba(140, 140, 140, 0.22)'), 'neutral presence fill');
        });

        test('hover title explains scroll map in plain language', () => {
            const script = getScrollbarMinimapScript();
            assert.ok(script.includes('Scroll map — click or drag'), 'plain hover explanation');
            // Hint now fires when info/debug/notice lines are being drawn as gray presence ticks,
            // pointing the user to the "Show info on minimap" setting to upgrade them to colored ticks.
            assert.ok(script.includes('Gray ticks are info/debug/notice'), 'explains gray presence ticks');
            assert.ok(script.includes('Show info on minimap'), 'points to the setting that enables colored info ticks');
        });
    });
});
