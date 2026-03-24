/**
 * Unit tests for Drift Advisor snapshot → meta mapping (Phase 5 built-in provider).
 */

import * as assert from 'node:assert';
import { DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION } from '../../../modules/integrations/drift-advisor-constants';
import {
    countAnomaliesBySeverity,
    snapshotToMetaPayload,
    snapshotToSidecarObject,
} from '../../../modules/integrations/providers/drift-advisor-snapshot-map';

suite('DriftAdvisorSnapshotMap', () => {
    test('countAnomaliesBySeverity handles empty input', () => {
        const empty = countAnomaliesBySeverity(undefined);
        assert.strictEqual(empty.count, 0);
        assert.deepStrictEqual(empty.bySeverity, { error: 0, warning: 0, info: 0 });
    });

    test('countAnomaliesBySeverity classifies severities', () => {
        const mixed = countAnomaliesBySeverity([
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
        const meta = snapshotToMetaPayload({
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
        assert.strictEqual(meta.schemaVersion, DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION);
    });

    test('snapshotToMetaPayload preserves snapshot schemaVersion when set', () => {
        const meta = snapshotToMetaPayload({
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
        const side = snapshotToSidecarObject({
            baseUrl: 'http://x',
            performance: null,
        });
        assert.strictEqual(typeof side.generatedAt, 'string');
        assert.strictEqual(side.schemaVersion, DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION);
    });

    test('snapshotToSidecarObject preserves snapshot schemaVersion when set', () => {
        const side = snapshotToSidecarObject({
            baseUrl: 'http://x',
            schemaVersion: 7,
            performance: null,
        });
        assert.strictEqual(side.schemaVersion, 7);
    });
});
