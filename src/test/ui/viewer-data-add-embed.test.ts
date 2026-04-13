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
});
