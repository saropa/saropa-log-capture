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
const assert = __importStar(require("node:assert"));
const drift_sql_fingerprint_summary_persist_1 = require("../../../modules/db/drift-sql-fingerprint-summary-persist");
suite('drift-sql-fingerprint-summary-persist', () => {
    const sampleEntry = {
        count: 3,
        avgDurationMs: 12.5,
        maxDurationMs: 40,
        durationSampleCount: 3,
    };
    test('isPersistedDriftSqlFingerprintSummaryV1 accepts v1 shape', () => {
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)({
            schemaVersion: drift_sql_fingerprint_summary_persist_1.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
            fingerprints: { fp1: { count: 1 } },
        }), true);
    });
    test('isPersistedDriftSqlFingerprintSummaryV1 rejects wrong version and missing fingerprints', () => {
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)(null), false);
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)({}), false);
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)({
            schemaVersion: 99,
            fingerprints: {},
        }), false);
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)({
            schemaVersion: drift_sql_fingerprint_summary_persist_1.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
        }), false);
    });
    test('isPersistedDriftSqlFingerprintSummaryV1 rejects array fingerprints (false positive guard)', () => {
        const malformed = {
            schemaVersion: drift_sql_fingerprint_summary_persist_1.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
            fingerprints: [],
        };
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)(malformed), false);
    });
    test('isPersistedDriftSqlFingerprintSummaryV1 accepts empty fingerprints record', () => {
        assert.strictEqual((0, drift_sql_fingerprint_summary_persist_1.isPersistedDriftSqlFingerprintSummaryV1)({
            schemaVersion: drift_sql_fingerprint_summary_persist_1.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
            fingerprints: {},
        }), true);
    });
    test('summaryMapToPersistedV1 round-trips through persistedSummaryToMap', () => {
        const map = new Map([['abc', sampleEntry]]);
        const firstLines = new Map([['abc', 42]]);
        const p = (0, drift_sql_fingerprint_summary_persist_1.summaryMapToPersistedV1)(map, firstLines);
        assert.strictEqual(p.schemaVersion, drift_sql_fingerprint_summary_persist_1.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION);
        assert.deepStrictEqual(p.firstOccurrenceLineByFingerprint, { abc: 42 });
        const back = (0, drift_sql_fingerprint_summary_persist_1.persistedSummaryToMap)(p);
        assert.strictEqual(back.size, 1);
        assert.deepStrictEqual(back.get('abc'), sampleEntry);
    });
    test('summaryMapToPersistedV1 omits firstOccurrenceLineByFingerprint when empty', () => {
        const p = (0, drift_sql_fingerprint_summary_persist_1.summaryMapToPersistedV1)(new Map([['x', { count: 1 }]]), new Map());
        assert.strictEqual(p.firstOccurrenceLineByFingerprint, undefined);
    });
    test('fingerprintSummaryMapToBaselineRecord matches persisted fingerprints object', () => {
        const map = new Map([['k', { count: 2, avgDurationMs: 1 }]]);
        const viaBaseline = (0, drift_sql_fingerprint_summary_persist_1.fingerprintSummaryMapToBaselineRecord)(map);
        const viaFull = (0, drift_sql_fingerprint_summary_persist_1.summaryMapToPersistedV1)(map).fingerprints;
        assert.deepStrictEqual(viaBaseline, viaFull);
    });
    test('persistedSummaryToBaselineRecord copies fingerprint entries', () => {
        const p = (0, drift_sql_fingerprint_summary_persist_1.summaryMapToPersistedV1)(new Map([['k', { count: 5 }]]));
        const rec = (0, drift_sql_fingerprint_summary_persist_1.persistedSummaryToBaselineRecord)(p);
        assert.deepStrictEqual(rec, { k: { count: 5 } });
    });
    test('trimSummaryForPersistence keeps all keys when under cap', () => {
        const summary = new Map([
            ['a', { count: 10 }],
            ['b', { count: 1 }],
        ]);
        const lines = new Map([
            ['a', 0],
            ['b', 99],
        ]);
        const { summary: s, firstLineByFingerprint: fl } = (0, drift_sql_fingerprint_summary_persist_1.trimSummaryForPersistence)(summary, lines, 500);
        assert.strictEqual(s.size, 2);
        assert.strictEqual(fl.get('a'), 0);
        assert.strictEqual(fl.get('b'), 99);
    });
    test('trimSummaryForPersistence keeps top-N by count and aligns line map', () => {
        const summary = new Map();
        const lines = new Map();
        for (let i = 0; i < 10; i++) {
            const key = `k${i}`;
            summary.set(key, { count: i });
            lines.set(key, i * 10);
        }
        const { summary: s, firstLineByFingerprint: fl } = (0, drift_sql_fingerprint_summary_persist_1.trimSummaryForPersistence)(summary, lines, 5);
        assert.strictEqual(s.size, 5);
        assert.ok(!s.has('k0'));
        assert.ok(s.has('k9'));
        assert.strictEqual(fl.size, 5);
        assert.strictEqual(fl.get('k9'), 90);
        assert.strictEqual(fl.get('k0'), undefined);
    });
    test('summaryMapToPersistedV1 round-trips slowQueryCount', () => {
        const map = new Map([
            ['s', { count: 2, slowQueryCount: 1 }],
        ]);
        const p = (0, drift_sql_fingerprint_summary_persist_1.summaryMapToPersistedV1)(map);
        assert.strictEqual(p.fingerprints.s?.slowQueryCount, 1);
        const back = (0, drift_sql_fingerprint_summary_persist_1.persistedSummaryToMap)(p);
        assert.strictEqual(back.get('s')?.slowQueryCount, 1);
    });
    test('trimSummaryForPersistence does not retain mid-tier keys when over cap (before/after)', () => {
        const summary = new Map([
            ['low', { count: 1 }],
            ['mid', { count: 50 }],
            ['high', { count: 100 }],
        ]);
        const lines = new Map([
            ['low', 1],
            ['mid', 2],
            ['high', 3],
        ]);
        const { summary: s, firstLineByFingerprint: fl } = (0, drift_sql_fingerprint_summary_persist_1.trimSummaryForPersistence)(summary, lines, 2);
        assert.strictEqual(s.size, 2);
        assert.ok(s.has('high') && s.has('mid'));
        assert.ok(!s.has('low'), 'low-count key must be dropped, not a false retain');
        assert.strictEqual(fl.get('mid'), 2);
        assert.strictEqual(fl.get('low'), undefined);
    });
});
//# sourceMappingURL=drift-sql-fingerprint-summary-persist.test.js.map