/**
 * String-level regression tests for the N+1 detector script chunk bundled into the viewer.
 */
import * as assert from 'assert';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { N_PLUS_ONE_EMBED_CONFIG } from '../../modules/db/drift-n-plus-one-detector';

suite('Viewer N+1 detector embed', () => {
    test('embed defines parseSqlFingerprint and detectNPlusOneInsight', () => {
        const chunk = getNPlusOneDetectorScript();
        assert.ok(chunk.includes('function parseSqlFingerprint'));
        assert.ok(chunk.includes('function detectNPlusOneInsight'));
        assert.ok(chunk.includes('function pruneNPlusOneFingerprints'));
        assert.ok(chunk.includes('sqlSnippet'));
        assert.ok(chunk.includes('function updateDbInsightRollup'));
    });

    test('embed interpolates thresholds from N_PLUS_ONE_EMBED_CONFIG', () => {
        const chunk = getNPlusOneDetectorScript();
        assert.ok(chunk.includes(`windowMs: ${N_PLUS_ONE_EMBED_CONFIG.windowMs}`));
        assert.ok(chunk.includes(`minRepeats: ${N_PLUS_ONE_EMBED_CONFIG.minRepeats}`));
    });

    test('full viewer data script includes N+1 insight row type in addToData', () => {
        const data = getViewerDataScript();
        assert.ok(data.includes("'n-plus-one-insight'"));
        assert.ok(data.includes('parseSqlFingerprint'));
        assert.ok(data.includes('dbInsight'));
    });
});
