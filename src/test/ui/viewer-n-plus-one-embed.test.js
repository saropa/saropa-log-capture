"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * String-level regression tests for the N+1 detector script chunk bundled into the viewer.
 */
const assert = __importStar(require("node:assert"));
const viewer_data_1 = require("../../ui/viewer/viewer-data");
const viewer_script_1 = require("../../ui/viewer/viewer-script");
const viewer_root_cause_hints_script_1 = require("../../ui/viewer/viewer-root-cause-hints-script");
const viewer_db_detector_framework_script_1 = require("../../ui/viewer/viewer-db-detector-framework-script");
const viewer_data_n_plus_one_script_1 = require("../../ui/viewer/viewer-data-n-plus-one-script");
const drift_n_plus_one_detector_1 = require("../../modules/db/drift-n-plus-one-detector");
const drift_db_repeat_thresholds_1 = require("../../modules/db/drift-db-repeat-thresholds");
const drift_db_slow_burst_thresholds_1 = require("../../modules/db/drift-db-slow-burst-thresholds");
const drift_db_slow_burst_detector_1 = require("../../modules/db/drift-db-slow-burst-detector");
suite('Viewer N+1 detector embed', () => {
    test('embed defines parseSqlFingerprint and detectNPlusOneInsight', () => {
        const chunk = (0, viewer_data_n_plus_one_script_1.getNPlusOneDetectorScript)();
        assert.ok(chunk.includes('function parseSqlFingerprint'));
        assert.ok(chunk.includes('function normalizeDriftSqlFingerprintSql'));
        assert.ok(chunk.includes('function detectNPlusOneInsight'));
        assert.ok(chunk.includes('function pruneNPlusOneFingerprints'));
        assert.ok(chunk.includes('sqlSnippet'));
        assert.ok(chunk.includes('function updateDbInsightRollup'));
        assert.ok(chunk.includes('function peekDbInsightRollup'));
        assert.ok(chunk.includes('function driftSqlSnippetFromPlain'));
        assert.ok(chunk.includes('function getDriftRepeatMinN'));
        assert.ok(chunk.includes('dbRepeatThresholds'));
    });
    test('embed interpolates thresholds from N_PLUS_ONE_EMBED_CONFIG', () => {
        const chunk = (0, viewer_data_n_plus_one_script_1.getNPlusOneDetectorScript)();
        assert.ok(chunk.includes(`windowMs: ${drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.windowMs}`));
        assert.ok(chunk.includes(`minRepeats: ${drift_n_plus_one_detector_1.N_PLUS_ONE_EMBED_CONFIG.minRepeats}`));
    });
    test('embed bakes default repeat thresholds for Drift SQL classes', () => {
        const chunk = (0, viewer_data_n_plus_one_script_1.getNPlusOneDetectorScript)();
        assert.ok(chunk.includes(`global: ${drift_db_repeat_thresholds_1.VIEWER_REPEAT_THRESHOLD_DEFAULTS.globalMinCount}`));
        assert.ok(chunk.includes(`read: ${drift_db_repeat_thresholds_1.VIEWER_REPEAT_THRESHOLD_DEFAULTS.readMinCount}`));
        assert.ok(chunk.includes(`dml: ${drift_db_repeat_thresholds_1.VIEWER_REPEAT_THRESHOLD_DEFAULTS.dmlMinCount}`));
    });
    test('viewer data script can bake DB insights off (viewerDbInsightsEnabled false)', () => {
        const data = (0, viewer_data_1.getViewerDataScript)({ viewerDbInsightsEnabled: false });
        assert.ok(data.includes('var viewerDbInsightsEnabled = false'));
    });
    test('viewer data script can bake static SQL affordance off (staticSqlFromFingerprintEnabled false)', () => {
        const data = (0, viewer_data_1.getViewerDataScript)({ viewerDbInsightsEnabled: true, staticSqlFromFingerprintEnabled: false });
        assert.ok(data.includes('var staticSqlFromFingerprintEnabled = false'));
    });
    test('full viewer data script includes N+1 insight row type, insightMeta, and DB_15 detector pipeline', () => {
        const data = (0, viewer_data_1.getViewerDataScript)();
        assert.ok(data.includes("'n-plus-one-insight'"));
        assert.ok(data.includes('insightMeta'));
        assert.ok(data.includes('parseSqlFingerprint'));
        assert.ok(data.includes('dbInsight'));
        assert.ok(data.includes('::sqlfp::'));
        assert.ok(data.includes('SQL repeated:'));
        assert.ok(data.includes('repeat-sql-fp'));
        assert.ok(data.includes('sql-repeat-drilldown-toggle'));
        assert.ok(data.includes('streakMinN'));
        assert.ok(data.includes('function runDbDetectors'));
        assert.ok(data.includes('function emitDbLineDetectors'));
        assert.ok(data.includes('applyDbAnnotateLineResult'));
        assert.ok(data.includes('db.ingest-rollup'));
        assert.ok(data.includes('function applyDbDetectorResultsInPriorityOrder'));
        assert.ok(data.includes('function peekDbInsightRollup'));
        assert.ok(data.includes('registerBuiltinDbDetectors'));
        assert.ok(data.includes('pruneDbDetectorStateAfterTrim'));
        assert.ok(data.includes('applyDbMarkerResults'));
        assert.ok(data.includes('slow-query-burst-marker'));
        assert.ok(data.includes('find-static-sources'));
    });
    test('viewer main script wires N+1 static-sources action to host message', () => {
        const vs = (0, viewer_script_1.getViewerScript)(100_000);
        assert.ok(vs.includes('find-static-sources'));
        assert.ok(vs.includes('findStaticSourcesForSqlFingerprint'));
    });
    test('root-cause hypotheses embed defines strip refresh and bundle builder', () => {
        const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
        assert.ok(chunk.includes('collectRootCauseHintBundleEmbedded'));
        assert.ok(chunk.includes('scheduleRootCauseHypothesesRefresh'));
        assert.ok(chunk.includes('resetRootCauseHypothesesSession'));
        assert.ok(chunk.includes('buildHypothesesEmbedded'));
        assert.ok(chunk.includes('clearRootCauseHintHostFields'));
        assert.ok(chunk.includes('slowBurstBySession'));
        assert.ok(chunk.includes('collectSessionDiffRegressionFpsEmbedded'));
        assert.ok(chunk.includes('updateSignalsBadge'));
        assert.ok(chunk.includes('explainRootCauseHypotheses'));
        assert.ok(chunk.includes('runTriggerExplainRootCauseHypothesesFromHost'));
        assert.ok(chunk.includes('explainRootCauseHypothesesEmpty'));
    });
    test('DB detector framework embed bakes slow burst thresholds and DB_08 detector id', () => {
        const chunk = (0, viewer_db_detector_framework_script_1.getViewerDbDetectorFrameworkScript)(true);
        assert.ok(chunk.includes('"slowQueryMs":' + drift_db_slow_burst_thresholds_1.VIEWER_SLOW_BURST_DEFAULTS.slowQueryMs));
        assert.ok(chunk.includes(drift_db_slow_burst_detector_1.SLOW_QUERY_BURST_DETECTOR_ID));
        assert.ok(chunk.includes('slowBurstBySession'));
    });
});
//# sourceMappingURL=viewer-n-plus-one-embed.test.js.map