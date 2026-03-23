/**
 * String-level regression tests for the N+1 detector script chunk bundled into the viewer.
 */
import * as assert from 'assert';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { N_PLUS_ONE_EMBED_CONFIG } from '../../modules/db/drift-n-plus-one-detector';
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';

suite('Viewer N+1 detector embed', () => {
    test('embed defines parseSqlFingerprint and detectNPlusOneInsight', () => {
        const chunk = getNPlusOneDetectorScript();
        assert.ok(chunk.includes('function parseSqlFingerprint'));
        assert.ok(chunk.includes('function normalizeDriftSqlFingerprintSql'));
        assert.ok(chunk.includes('function detectNPlusOneInsight'));
        assert.ok(chunk.includes('function pruneNPlusOneFingerprints'));
        assert.ok(chunk.includes('sqlSnippet'));
        assert.ok(chunk.includes('function updateDbInsightRollup'));
        assert.ok(chunk.includes('function getDriftRepeatMinN'));
        assert.ok(chunk.includes('dbRepeatThresholds'));
    });

    test('embed interpolates thresholds from N_PLUS_ONE_EMBED_CONFIG', () => {
        const chunk = getNPlusOneDetectorScript();
        assert.ok(chunk.includes(`windowMs: ${N_PLUS_ONE_EMBED_CONFIG.windowMs}`));
        assert.ok(chunk.includes(`minRepeats: ${N_PLUS_ONE_EMBED_CONFIG.minRepeats}`));
    });

    test('embed bakes default repeat thresholds for Drift SQL classes', () => {
        const chunk = getNPlusOneDetectorScript();
        assert.ok(chunk.includes(`global: ${VIEWER_REPEAT_THRESHOLD_DEFAULTS.globalMinCount}`));
        assert.ok(chunk.includes(`read: ${VIEWER_REPEAT_THRESHOLD_DEFAULTS.readMinCount}`));
        assert.ok(chunk.includes(`dml: ${VIEWER_REPEAT_THRESHOLD_DEFAULTS.dmlMinCount}`));
    });

    test('full viewer data script includes N+1 insight row type in addToData', () => {
        const data = getViewerDataScript();
        assert.ok(data.includes("'n-plus-one-insight'"));
        assert.ok(data.includes('parseSqlFingerprint'));
        assert.ok(data.includes('dbInsight'));
        assert.ok(data.includes('::dbfp::'));
        assert.ok(data.includes('streakMinN'));
    });
});
