"use strict";
/**
 * Unit tests for Drift Advisor snapshot → meta mapping (Phase 5 built-in provider).
 */
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
const assert = __importStar(require("node:assert"));
const drift_advisor_constants_1 = require("../../../modules/integrations/drift-advisor-constants");
const drift_advisor_snapshot_map_1 = require("../../../modules/integrations/providers/drift-advisor-snapshot-map");
suite('DriftAdvisorSnapshotMap', () => {
    test('countAnomaliesBySeverity handles empty input', () => {
        const empty = (0, drift_advisor_snapshot_map_1.countAnomaliesBySeverity)(undefined);
        assert.strictEqual(empty.count, 0);
        assert.deepStrictEqual(empty.bySeverity, { error: 0, warning: 0, info: 0 });
    });
    test('countAnomaliesBySeverity classifies severities', () => {
        const mixed = (0, drift_advisor_snapshot_map_1.countAnomaliesBySeverity)([
            { severity: 'error' },
            { severity: 'Warning' },
            { severity: 'info' },
            {},
        ]);
        assert.strictEqual(mixed.count, 4);
        assert.strictEqual(mixed.bySeverity.error, 1);
        assert.strictEqual(mixed.bySeverity.warning, 1);
        assert.strictEqual(mixed.bySeverity.info, 2);
    });
    test('snapshotToMetaPayload maps documented fields', () => {
        const meta = (0, drift_advisor_snapshot_map_1.snapshotToMetaPayload)({
            baseUrl: 'http://127.0.0.1:1234',
            performance: {
                totalQueries: 10,
                totalDurationMs: 100,
                avgDurationMs: 10,
                slowCount: 2,
                topSlow: [{ sql: 'SELECT 1', durationMs: 5 }],
            },
            anomalies: [{ severity: 'error' }],
            schemaSummary: { tableCount: 3, tableNames: ['a', 'b'] },
            health: { ok: true, extensionConnected: true },
            indexSuggestionsCount: 1,
        });
        assert.strictEqual(meta.baseUrl, 'http://127.0.0.1:1234');
        assert.strictEqual(meta.performance.totalQueries, 10);
        assert.strictEqual(meta.performance.slowCount, 2);
        assert.strictEqual(meta.performance.topSlow.length, 1);
        assert.strictEqual(meta.anomalies.count, 1);
        assert.strictEqual(meta.schema.tableCount, 3);
        assert.strictEqual(meta.schema.tableNames?.length, 2);
        assert.strictEqual(meta.health.ok, true);
        assert.strictEqual(meta.indexSuggestionsCount, 1);
        assert.strictEqual(meta.schemaVersion, drift_advisor_constants_1.DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION);
    });
    test('snapshotToMetaPayload preserves snapshot schemaVersion when set', () => {
        const meta = (0, drift_advisor_snapshot_map_1.snapshotToMetaPayload)({
            baseUrl: 'http://x',
            schemaVersion: 99,
            performance: { totalQueries: 0, totalDurationMs: 0, avgDurationMs: 0, slowCount: 0, topSlow: [] },
            anomalies: [],
            schemaSummary: { tableCount: 0 },
            health: { ok: true },
        });
        assert.strictEqual(meta.schemaVersion, 99);
    });
    test('snapshotToSidecarObject sets generatedAt and schemaVersion', () => {
        const side = (0, drift_advisor_snapshot_map_1.snapshotToSidecarObject)({
            baseUrl: 'http://x',
            performance: null,
        });
        assert.strictEqual(typeof side.generatedAt, 'string');
        assert.strictEqual(side.schemaVersion, drift_advisor_constants_1.DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION);
    });
    test('snapshotToSidecarObject preserves snapshot schemaVersion when set', () => {
        const side = (0, drift_advisor_snapshot_map_1.snapshotToSidecarObject)({
            baseUrl: 'http://x',
            schemaVersion: 7,
            performance: null,
        });
        assert.strictEqual(side.schemaVersion, 7);
    });
});
//# sourceMappingURL=drift-advisor-snapshot-map.test.js.map