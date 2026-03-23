import * as assert from 'node:assert';
import type { DbFingerprintSummaryEntry } from '../../../modules/db/db-detector-types';
import {
    DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
    fingerprintSummaryMapToBaselineRecord,
    isPersistedDriftSqlFingerprintSummaryV1,
    persistedSummaryToBaselineRecord,
    persistedSummaryToMap,
    summaryMapToPersistedV1,
    trimSummaryForPersistence,
} from '../../../modules/db/drift-sql-fingerprint-summary-persist';

suite('drift-sql-fingerprint-summary-persist', () => {
    const sampleEntry: DbFingerprintSummaryEntry = {
        count: 3,
        avgDurationMs: 12.5,
        maxDurationMs: 40,
        durationSampleCount: 3,
    };

    test('isPersistedDriftSqlFingerprintSummaryV1 accepts v1 shape', () => {
        assert.strictEqual(
            isPersistedDriftSqlFingerprintSummaryV1({
                schemaVersion: DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
                fingerprints: { fp1: { count: 1 } },
            }),
            true,
        );
    });

    test('isPersistedDriftSqlFingerprintSummaryV1 rejects wrong version and missing fingerprints', () => {
        assert.strictEqual(isPersistedDriftSqlFingerprintSummaryV1(null), false);
        assert.strictEqual(isPersistedDriftSqlFingerprintSummaryV1({}), false);
        assert.strictEqual(
            isPersistedDriftSqlFingerprintSummaryV1({
                schemaVersion: 99,
                fingerprints: {},
            }),
            false,
        );
        assert.strictEqual(
            isPersistedDriftSqlFingerprintSummaryV1({
                schemaVersion: DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
            }),
            false,
        );
    });

    test('isPersistedDriftSqlFingerprintSummaryV1 rejects array fingerprints (false positive guard)', () => {
        const malformed = {
            schemaVersion: DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
            fingerprints: [],
        };
        assert.strictEqual(isPersistedDriftSqlFingerprintSummaryV1(malformed), false);
    });

    test('isPersistedDriftSqlFingerprintSummaryV1 accepts empty fingerprints record', () => {
        assert.strictEqual(
            isPersistedDriftSqlFingerprintSummaryV1({
                schemaVersion: DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
                fingerprints: {},
            }),
            true,
        );
    });

    test('summaryMapToPersistedV1 round-trips through persistedSummaryToMap', () => {
        const map = new Map<string, DbFingerprintSummaryEntry>([['abc', sampleEntry]]);
        const firstLines = new Map([['abc', 42]]);
        const p = summaryMapToPersistedV1(map, firstLines);
        assert.strictEqual(p.schemaVersion, DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION);
        assert.deepStrictEqual(p.firstOccurrenceLineByFingerprint, { abc: 42 });
        const back = persistedSummaryToMap(p);
        assert.strictEqual(back.size, 1);
        assert.deepStrictEqual(back.get('abc'), sampleEntry);
    });

    test('summaryMapToPersistedV1 omits firstOccurrenceLineByFingerprint when empty', () => {
        const p = summaryMapToPersistedV1(new Map([['x', { count: 1 }]]), new Map());
        assert.strictEqual(p.firstOccurrenceLineByFingerprint, undefined);
    });

    test('fingerprintSummaryMapToBaselineRecord matches persisted fingerprints object', () => {
        const map = new Map<string, DbFingerprintSummaryEntry>([['k', { count: 2, avgDurationMs: 1 }]]);
        const viaBaseline = fingerprintSummaryMapToBaselineRecord(map);
        const viaFull = summaryMapToPersistedV1(map).fingerprints;
        assert.deepStrictEqual(viaBaseline, viaFull);
    });

    test('persistedSummaryToBaselineRecord copies fingerprint entries', () => {
        const p = summaryMapToPersistedV1(new Map([['k', { count: 5 }]]));
        const rec = persistedSummaryToBaselineRecord(p);
        assert.deepStrictEqual(rec, { k: { count: 5 } });
    });

    test('trimSummaryForPersistence keeps all keys when under cap', () => {
        const summary = new Map<string, DbFingerprintSummaryEntry>([
            ['a', { count: 10 }],
            ['b', { count: 1 }],
        ]);
        const lines = new Map([
            ['a', 0],
            ['b', 99],
        ]);
        const { summary: s, firstLineByFingerprint: fl } = trimSummaryForPersistence(summary, lines, 500);
        assert.strictEqual(s.size, 2);
        assert.strictEqual(fl.get('a'), 0);
        assert.strictEqual(fl.get('b'), 99);
    });

    test('trimSummaryForPersistence keeps top-N by count and aligns line map', () => {
        const summary = new Map<string, DbFingerprintSummaryEntry>();
        const lines = new Map<string, number>();
        for (let i = 0; i < 10; i++) {
            const key = `k${i}`;
            summary.set(key, { count: i });
            lines.set(key, i * 10);
        }
        const { summary: s, firstLineByFingerprint: fl } = trimSummaryForPersistence(summary, lines, 5);
        assert.strictEqual(s.size, 5);
        assert.ok(!s.has('k0'));
        assert.ok(s.has('k9'));
        assert.strictEqual(fl.size, 5);
        assert.strictEqual(fl.get('k9'), 90);
        assert.strictEqual(fl.get('k0'), undefined);
    });

    test('summaryMapToPersistedV1 round-trips slowQueryCount', () => {
        const map = new Map<string, DbFingerprintSummaryEntry>([
            ['s', { count: 2, slowQueryCount: 1 }],
        ]);
        const p = summaryMapToPersistedV1(map);
        assert.strictEqual(p.fingerprints.s?.slowQueryCount, 1);
        const back = persistedSummaryToMap(p);
        assert.strictEqual(back.get('s')?.slowQueryCount, 1);
    });

    test('trimSummaryForPersistence does not retain mid-tier keys when over cap (before/after)', () => {
        const summary = new Map<string, DbFingerprintSummaryEntry>([
            ['low', { count: 1 }],
            ['mid', { count: 50 }],
            ['high', { count: 100 }],
        ]);
        const lines = new Map([
            ['low', 1],
            ['mid', 2],
            ['high', 3],
        ]);
        const { summary: s, firstLineByFingerprint: fl } = trimSummaryForPersistence(summary, lines, 2);
        assert.strictEqual(s.size, 2);
        assert.ok(s.has('high') && s.has('mid'));
        assert.ok(!s.has('low'), 'low-count key must be dropped, not a false retain');
        assert.strictEqual(fl.get('mid'), 2);
        assert.strictEqual(fl.get('low'), undefined);
    });
});
