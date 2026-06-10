/**
 * DB_18 — persisted cumulative SQL fingerprint index (pure functions) unit tests.
 *
 * Covers: incremental merge (sum count, max maxDur, newest-wins firstSource), idempotency on
 * filename (no double-count on re-finalize), rebuild-from-metas parity, and active-log exclusion
 * via summary subtraction (drop-to-zero rows, missingSummaryLogCount).
 */
import * as assert from 'node:assert';
import * as vscode from 'vscode';
import {
    buildCumulativeSqlFingerprintIndex,
    emptyCumulativeSqlFingerprintIndex,
    indexToPayloadExcludingActive,
    isCumulativeSqlFingerprintIndexV1,
    mergeSummaryIntoCumulativeSqlFingerprintIndex,
} from '../../../modules/db/cumulative-sql-fingerprint-index';
import type { MetaUriResolver } from '../../../modules/db/cumulative-sql-fingerprint-aggregator';
import type { LoadedMeta } from '../../../modules/session/metadata-loader';
import type {
    PersistedDriftSqlFingerprintEntryV1,
    PersistedDriftSqlFingerprintSummaryV1,
} from '../../../modules/db/drift-sql-fingerprint-summary-persist';
import type { SessionMeta } from '../../../modules/session/session-metadata';

function summary(
    fingerprints: Record<string, PersistedDriftSqlFingerprintEntryV1>,
    firstLines?: Record<string, number>,
): PersistedDriftSqlFingerprintSummaryV1 {
    return {
        schemaVersion: 1,
        fingerprints,
        ...(firstLines ? { firstOccurrenceLineByFingerprint: firstLines } : {}),
    };
}

function loaded(filename: string, s: PersistedDriftSqlFingerprintSummaryV1): LoadedMeta {
    const meta: SessionMeta = { driftSqlFingerprintSummary: s };
    return { filename, meta };
}

const resolver: MetaUriResolver = {
    resolveLogUriString: (filename) => vscode.Uri.parse('file:///r/' + filename).toString(),
};

const uriFor = (filename: string): string => vscode.Uri.parse('file:///r/' + filename).toString();

suite('cumulative SQL fingerprint index (DB_18)', () => {
    test('isCumulativeSqlFingerprintIndexV1 rejects wrong schema / shape', () => {
        assert.strictEqual(isCumulativeSqlFingerprintIndexV1(null), false);
        assert.strictEqual(isCumulativeSqlFingerprintIndexV1({ schemaVersion: 2, contributingLogs: [], fingerprints: {} }), false);
        assert.strictEqual(isCumulativeSqlFingerprintIndexV1({ schemaVersion: 1, contributingLogs: {}, fingerprints: {} }), false);
        assert.strictEqual(isCumulativeSqlFingerprintIndexV1(emptyCumulativeSqlFingerprintIndex()), true);
    });

    test('incremental merge sums count, takes max maxDur, and the merged (newest) log wins firstSource', () => {
        let index = emptyCumulativeSqlFingerprintIndex();
        index = mergeSummaryIntoCumulativeSqlFingerprintIndex(
            index, 'older.log', summary({ fp: { count: 9, maxDurationMs: 100 } }, { fp: 7 }), uriFor('older.log'),
        );
        index = mergeSummaryIntoCumulativeSqlFingerprintIndex(
            index, 'newer.log', summary({ fp: { count: 1, maxDurationMs: 250 } }, { fp: 42 }), uriFor('newer.log'),
        );
        assert.strictEqual(index.fingerprints.fp.count, 10);
        assert.strictEqual(index.fingerprints.fp.maxDurationMs, 250);
        assert.strictEqual(index.fingerprints.fp.logCount, 2);
        assert.strictEqual(index.fingerprints.fp.firstSourceUriString, uriFor('newer.log'), 'newest wins');
        assert.strictEqual(index.fingerprints.fp.firstSourceLine, 42);
        assert.deepStrictEqual([...index.contributingLogs], ['older.log', 'newer.log']);
    });

    test('merge is idempotent on filename — re-finalizing the same log does not double-count', () => {
        let index = emptyCumulativeSqlFingerprintIndex();
        const s = summary({ fp: { count: 5 } });
        index = mergeSummaryIntoCumulativeSqlFingerprintIndex(index, 'a.log', s, uriFor('a.log'));
        const again = mergeSummaryIntoCumulativeSqlFingerprintIndex(index, 'a.log', s, uriFor('a.log'));
        assert.strictEqual(again, index, 'reference-equal no-op on duplicate filename');
        assert.strictEqual(again.fingerprints.fp.count, 5);
    });

    test('rebuild from metas matches incremental merge for the same logs', () => {
        const metas: LoadedMeta[] = [
            loaded('newer.log', summary({ fp: { count: 1 } }, { fp: 42 })),
            loaded('older.log', summary({ fp: { count: 9 } }, { fp: 7 })),
        ];
        const rebuilt = buildCumulativeSqlFingerprintIndex(metas, resolver);
        assert.strictEqual(rebuilt.fingerprints.fp.count, 10);
        assert.strictEqual(rebuilt.contributingLogs.length, 2);
        // Aggregator keeps first-in-array (newer) as firstSource — newest-first ordering is the caller's job.
        assert.strictEqual(rebuilt.fingerprints.fp.firstSourceUriString, uriFor('newer.log'));
    });

    test('payload excludes the active log by subtracting its summary; rows that drop to zero disappear', () => {
        let index = emptyCumulativeSqlFingerprintIndex();
        index = mergeSummaryIntoCumulativeSqlFingerprintIndex(
            index, 'active.log', summary({ fpA: { count: 100 }, fpOnlyActive: { count: 3 } }), uriFor('active.log'),
        );
        index = mergeSummaryIntoCumulativeSqlFingerprintIndex(
            index, 'other.log', summary({ fpA: { count: 1 }, fpB: { count: 4 } }), uriFor('other.log'),
        );
        const payload = indexToPayloadExcludingActive(index, 'active.log', summary({ fpA: { count: 100 }, fpOnlyActive: { count: 3 } }), 2);
        assert.strictEqual(payload.contributingLogCount, 1, 'active excluded from the contributing count');
        assert.strictEqual(payload.fingerprints.fpA.count, 1, 'fpA from other.log only after subtraction');
        assert.strictEqual(payload.fingerprints.fpB.count, 4);
        assert.strictEqual(payload.fingerprints.fpOnlyActive, undefined, 'active-only fp drops out entirely');
    });

    test('no active summary → full index passes through; missingSummaryLogCount reflects unindexed files', () => {
        let index = emptyCumulativeSqlFingerprintIndex();
        index = mergeSummaryIntoCumulativeSqlFingerprintIndex(index, 'a.log', summary({ fp: { count: 2 } }), uriFor('a.log'));
        const payload = indexToPayloadExcludingActive(index, undefined, undefined, 5);
        assert.strictEqual(payload.fingerprints.fp.count, 2);
        assert.strictEqual(payload.contributingLogCount, 1);
        assert.strictEqual(payload.missingSummaryLogCount, 4, '5 files on disk, 1 indexed → 4 without a summary');
    });
});
