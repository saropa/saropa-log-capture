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

    test('new stack-header row defaults to fully expanded (not stack preview)', () => {
        const block = extractAddToDataBlock(getViewerDataAddScript());
        assert.ok(block.length > 0, 'expected addToData block');
        assert.ok(
            block.includes("type: 'stack-header'") && block.includes('frameCount: 1, collapsed: false'),
            'new traces should default to expanded so frames are not hidden behind [+N more]',
        );
        assert.ok(
            !block.includes("frameCount: 1, collapsed: 'preview'"),
            'regression: preview default would hide frames until user expands',
        );
    });
});
