/**
 * String-level regression tests for the N+1 detector script chunk bundled into the viewer.
 */
import * as assert from 'node:assert';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';
import { getViewerRootCauseHintsScript } from '../../ui/viewer/viewer-root-cause-hints-script';
import { getViewerDbDetectorFrameworkScript } from '../../ui/viewer/viewer-db-detector-framework-script';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { N_PLUS_ONE_EMBED_CONFIG } from '../../modules/db/drift-n-plus-one-detector';
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';
import { VIEWER_SLOW_BURST_DEFAULTS } from '../../modules/db/drift-db-slow-burst-thresholds';
import { SLOW_QUERY_BURST_DETECTOR_ID } from '../../modules/db/drift-db-slow-burst-detector';

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

    test('viewer data script can bake DB insights off (viewerDbInsightsEnabled false)', () => {
        const data = getViewerDataScript(undefined, false);
        assert.ok(data.includes('var viewerDbInsightsEnabled = false'));
    });

    test('full viewer data script includes N+1 insight row type, insightMeta, and DB_15 detector pipeline', () => {
        const data = getViewerDataScript();
        assert.ok(data.includes("'n-plus-one-insight'"));
        assert.ok(data.includes('insightMeta'));
        assert.ok(data.includes('parseSqlFingerprint'));
        assert.ok(data.includes('dbInsight'));
        assert.ok(data.includes('::sqlfp::'));
        assert.ok(data.includes('SQL repeated #'));
        assert.ok(data.includes('repeat-sql-fp'));
        assert.ok(data.includes('sql-repeat-drilldown-toggle'));
        assert.ok(data.includes('streakMinN'));
        assert.ok(data.includes('function runDbDetectors'));
        assert.ok(data.includes('function emitDbLineDetectors'));
        assert.ok(data.includes('registerBuiltinDbDetectors'));
        assert.ok(data.includes('pruneDbDetectorStateAfterTrim'));
        assert.ok(data.includes('applyDbMarkerResults'));
        assert.ok(data.includes('slow-query-burst-marker'));
    });

    test('root-cause hypotheses embed defines strip refresh and bundle builder', () => {
        const chunk = getViewerRootCauseHintsScript();
        assert.ok(chunk.includes('collectRootCauseHintBundleEmbedded'));
        assert.ok(chunk.includes('scheduleRootCauseHypothesesRefresh'));
        assert.ok(chunk.includes('resetRootCauseHypothesesSession'));
        assert.ok(chunk.includes('buildHypothesesEmbedded'));
        assert.ok(chunk.includes('clearRootCauseHintHostFields'));
        assert.ok(chunk.includes('slowBurstBySession'));
        assert.ok(chunk.includes('collectSessionDiffRegressionFpsEmbedded'));
        assert.ok(chunk.includes('rchCollapseStorageKey'));
        assert.ok(chunk.includes('explainRootCauseHypotheses'));
    });

    test('DB detector framework embed bakes slow burst thresholds and DB_08 detector id', () => {
        const chunk = getViewerDbDetectorFrameworkScript(true);
        assert.ok(chunk.includes('"slowQueryMs":' + VIEWER_SLOW_BURST_DEFAULTS.slowQueryMs));
        assert.ok(chunk.includes(SLOW_QUERY_BURST_DETECTOR_ID));
        assert.ok(chunk.includes('slowBurstBySession'));
    });
});
