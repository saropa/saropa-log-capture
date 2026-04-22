/**
 * Regression tests for the embedded `addToData` script (string extraction).
 * Guards single-parse semantics and database-only SQL fingerprint repeat keys.
 */
import * as assert from 'node:assert';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';

function extractAddToDataBlock(script: string): string {
    const start = script.indexOf('function addToData(');
    const end = script.indexOf('\nfunction toggleStackGroup(');
    if (start < 0 || end < 0 || end <= start) {
        return '';
    }
    return script.slice(start, end);
}

suite('viewer-data-add embed', () => {
    test('addToData calls parseSqlFingerprint(plain) exactly once', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        assert.ok(block.length > 0, 'expected addToData block');
        const matches = block.match(/parseSqlFingerprint\(plain\)/g);
        assert.strictEqual(
            matches ? matches.length : 0,
            1,
            'duplicate parseSqlFingerprint(plain) reintroduces per-line cost and drift risk',
        );
    });

    test('SQL repeat key requires database tag (false positive: Drift text without tag)', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        assert.ok(
            block.includes('sTag === \'database\'') && block.includes('sqlMeta.fingerprint'),
            'repeat hash must gate sqlfp on source tag so non-database Drift-shaped noise does not use fingerprint key',
        );
        assert.ok(
            !block.includes('sqlMetaRepeat'),
            'legacy sqlMetaRepeat name should stay removed to avoid two-parse regression',
        );
    });

    test('stack-header uses configurable default state via stackDefaultState var', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        assert.ok(block.length > 0, 'expected addToData block');
        assert.ok(
            block.includes("type: 'stack-header'") && block.includes('collapsed: _sds'),
            'stack-header collapsed state should use the configurable _sds variable',
        );
        assert.ok(
            block.includes('? stackDefaultState : false'),
            'stackDefaultState should default to false (expanded) when not configured',
        );
    });
});

suite('viewer-data-add device-other demotion preserves originalLevel (plan 050)', () => {
    test('should capture preDemotionLevel before device-other demotion', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        assert.ok(block.length > 0, 'expected addToData block');
        /* preDemotionLevel must be declared BEFORE the demotion conditional so the
           original classifyLevel result is captured before it gets overwritten. */
        const preDemotionIdx = block.indexOf('var preDemotionLevel = lvl');
        const demotionIdx = block.indexOf("device-other' && (lvl === 'error' || lvl === 'warning')");
        assert.ok(preDemotionIdx >= 0, 'preDemotionLevel variable must exist');
        assert.ok(demotionIdx >= 0, 'device-other demotion must exist');
        assert.ok(
            preDemotionIdx < demotionIdx,
            'preDemotionLevel must be captured BEFORE the demotion line runs',
        );
    });

    test('should set originalLevel on lineItem only when demotion changed the level', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        /* The conditional assignment ensures originalLevel is only stored when
           demotion actually fired — saves memory on the majority of non-demoted lines. */
        assert.ok(
            block.includes('if (preDemotionLevel !== lvl) lineItem.originalLevel = preDemotionLevel'),
            'originalLevel must be set conditionally when preDemotionLevel differs from lvl',
        );
    });

    test('demotion still sets lvl to info for display (no visual change)', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        /* The demotion line itself must still exist — display behavior is unchanged. */
        assert.ok(
            block.includes("lvl = 'info'"),
            'device-other demotion must still overwrite lvl to info for display',
        );
    });

    test('recentErrorContext skips device-other lines so demotion is not undone', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        /* Before this fix, device-other lines were demoted to info (line 149), then
           the recentErrorContext check (line 156) only tested `lvl === 'info'` and
           re-promoted them to error — undoing the demotion.  The guard ensures
           framework noise (ActivityManager, WindowManager, etc.) stays suppressed. */
        assert.ok(
            block.includes("lineTier !== 'device-other'"),
            'recentErrorContext condition must exclude device-other tier to prevent re-promotion of demoted lines',
        );
        /* The device-other guard must appear in the same conditional as the
           existing recentErrorContext checks (lvl === info, !isSep, !skipProximityInherit). */
        const condLine = block.split('\n').find(
            (l: string) => l.includes("lineTier !== 'device-other'") && l.includes("lvl === 'info'"),
        );
        assert.ok(
            condLine,
            'device-other guard must be in the same if-condition as the lvl === info check',
        );
    });
});

suite('viewer-data-add blank rows compacted at birth', () => {
    /* Why these tests: calcItemHeight() compacts blank `type: 'line'` rows to
       quarter-height, but streaming arrivals do not trigger recalcHeights() so
       the gate never fires on insertion. Before this fix, a whitespace-only log
       line was born at ROW_HEIGHT in addToData and rendered as a full-height gap
       until the next filter pass. Both the structured-file (docItem) and
       regular log-line (lineItem) creation paths must stamp the same
       quarter-height value calcItemHeight would return, gated on the same
       !hidden precondition so filtered-out rows still collapse to 0. */

    test('structured-file (docItem) branch stamps quarter-height for blank html at birth', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        assert.ok(block.length > 0, 'expected addToData block');
        /* Birth-height formula must match calcItemHeight's gate value exactly
           so addToData and a later recalcHeights() agree on the same row. */
        assert.ok(
            block.includes('_docBlank') && block.includes('isLineContentBlank({ html: html })'),
            'docItem path must consult isLineContentBlank for the blank-at-birth decision',
        );
        assert.ok(
            block.includes('_docBlank ? Math.max(4, Math.floor(ROW_HEIGHT / 4)) : ROW_HEIGHT'),
            'docItem blank branch must use the same quarter-height value as calcItemHeight',
        );
        /* The blank check must be skipped for already-hidden rows so
           filtered-out items stay at height 0, not quarter. */
        assert.ok(
            block.includes('!_docHidden && typeof isLineContentBlank'),
            'docItem blank check must be gated on !_docHidden so filtered rows still collapse to 0',
        );
    });

    test('regular log-line (lineItem) branch stamps quarter-height for blank html at birth', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        /* lineItem birth-height must quarter-compact blanks on arrival, matching
           calcItemHeight's ROW_HEIGHT/4 value so there is no jump on next filter pass. */
        assert.ok(
            block.includes('_lineBlank') && block.includes('_lineBlank ? Math.max(4, Math.floor(ROW_HEIGHT / 4)) : ROW_HEIGHT'),
            'lineItem blank branch must use the same quarter-height value as calcItemHeight',
        );
        assert.ok(
            block.includes('!_lineHidden && typeof isLineContentBlank'),
            'lineItem blank check must be gated on !_lineHidden so filtered rows still collapse to 0',
        );
    });
});
