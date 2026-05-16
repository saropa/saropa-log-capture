/**
 * DB_17 Step 1 — host-side aggregator unit tests.
 *
 * Covers: merge math (sum count, max maxDur, sum slowQueryCount), active-log exclusion,
 * first-source attribution following metas order, missing-summary log counting, and the
 * `firstOccurrenceLineByFingerprint` propagation needed for cross-log jumps.
 */
import * as assert from 'node:assert';
import * as vscode from 'vscode';
import {
    aggregateCumulativeSqlFingerprints,
    type MetaUriResolver,
} from '../../../modules/db/cumulative-sql-fingerprint-aggregator';
import type { LoadedMeta } from '../../../modules/session/metadata-loader';
import type {
    PersistedDriftSqlFingerprintEntryV1,
    PersistedDriftSqlFingerprintSummaryV1,
} from '../../../modules/db/drift-sql-fingerprint-summary-persist';
import type { SessionMeta } from '../../../modules/session/session-metadata';

/** Build a minimal SessionMeta with only the persisted fingerprint summary. */
function metaWithFingerprints(
    fingerprints: Record<string, PersistedDriftSqlFingerprintEntryV1>,
    firstLines?: Record<string, number>,
): SessionMeta {
    const summary: PersistedDriftSqlFingerprintSummaryV1 = {
        schemaVersion: 1,
        fingerprints,
        ...(firstLines ? { firstOccurrenceLineByFingerprint: firstLines } : {}),
    };
    return { driftSqlFingerprintSummary: summary };
}

function loaded(filename: string, meta: SessionMeta): LoadedMeta {
    return { filename, meta };
}

/** Resolver that pretends every relative filename is a child of file:///r/. */
const fakeResolver: MetaUriResolver = {
    resolveLogUriString(filename) {
        return vscode.Uri.parse('file:///r/' + filename).toString();
    },
};

suite('cumulative SQL fingerprint aggregator (DB_17 Step 1)', () => {
    test('sums count and slowQueryCount, takes max of maxDurationMs across logs', () => {
        const metas: LoadedMeta[] = [
            loaded('a.log', metaWithFingerprints({
                fp1: { count: 5, maxDurationMs: 100, slowQueryCount: 1 },
                fp2: { count: 2 },
            })),
            loaded('b.log', metaWithFingerprints({
                fp1: { count: 3, maxDurationMs: 250, slowQueryCount: 2 },
            })),
        ];
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, undefined);
        assert.strictEqual(out.contributingLogCount, 2);
        assert.strictEqual(out.fingerprints.fp1.count, 8);
        assert.strictEqual(out.fingerprints.fp1.maxDurationMs, 250);
        assert.strictEqual(out.fingerprints.fp1.slowQueryCount, 3);
        assert.strictEqual(out.fingerprints.fp1.logCount, 2);
        assert.strictEqual(out.fingerprints.fp2.count, 2);
        assert.strictEqual(out.fingerprints.fp2.logCount, 1);
        assert.strictEqual(out.fingerprints.fp2.maxDurationMs, undefined);
    });

    test('excludes active log so the live webview rollup is not double-counted', () => {
        const metas: LoadedMeta[] = [
            loaded('active.log', metaWithFingerprints({ fpA: { count: 100 } })),
            loaded('other.log', metaWithFingerprints({ fpA: { count: 1 }, fpB: { count: 4 } })),
        ];
        const activeUri = vscode.Uri.parse('file:///r/active.log').toString();
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, activeUri);
        assert.strictEqual(out.contributingLogCount, 1);
        assert.strictEqual(out.fingerprints.fpA.count, 1, 'fpA from other.log only');
        assert.strictEqual(out.fingerprints.fpB.count, 4);
    });

    test('first log to contribute a fingerprint becomes firstSourceUriString (caller orders metas)', () => {
        const metas: LoadedMeta[] = [
            loaded('newer.log', metaWithFingerprints({ fp: { count: 1 } }, { fp: 42 })),
            loaded('older.log', metaWithFingerprints({ fp: { count: 9 } }, { fp: 7 })),
        ];
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, undefined);
        assert.strictEqual(out.fingerprints.fp.firstSourceUriString, 'file:///r/newer.log');
        assert.strictEqual(out.fingerprints.fp.firstSourceLine, 42);
        assert.strictEqual(out.fingerprints.fp.count, 10);
    });

    test('logs without a persisted summary are counted as missingSummaryLogCount', () => {
        const metas: LoadedMeta[] = [
            loaded('hasSummary.log', metaWithFingerprints({ fp: { count: 1 } })),
            loaded('blank.log', {}),
            loaded('alsoBlank.log', {}),
        ];
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, undefined);
        assert.strictEqual(out.contributingLogCount, 1);
        assert.strictEqual(out.missingSummaryLogCount, 2);
    });

    test('rejects malformed schemaVersion (stale on-disk format)', () => {
        const bogusMeta: SessionMeta = {
            driftSqlFingerprintSummary: {
                schemaVersion: 999 as 1, /* deliberately wrong; isPersisted... must reject */
                fingerprints: { fpZ: { count: 1 } },
            },
        };
        const metas: LoadedMeta[] = [loaded('bogus.log', bogusMeta)];
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, undefined);
        assert.strictEqual(out.contributingLogCount, 0);
        /* Bogus summary counts as "missing" so the UI can hint about a re-scan. */
        assert.strictEqual(out.missingSummaryLogCount, 1);
        assert.strictEqual(Object.keys(out.fingerprints).length, 0);
    });

    test('empty fingerprints object on a log does not increment contributingLogCount', () => {
        const metas: LoadedMeta[] = [loaded('emptySummary.log', metaWithFingerprints({}))];
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, undefined);
        assert.strictEqual(out.contributingLogCount, 0);
        assert.strictEqual(out.missingSummaryLogCount, 0);
    });

    test('omits firstSourceLine when no firstOccurrenceLineByFingerprint provided', () => {
        const metas: LoadedMeta[] = [
            loaded('noLines.log', metaWithFingerprints({ fp: { count: 3 } })),
        ];
        const out = aggregateCumulativeSqlFingerprints(metas, fakeResolver, undefined);
        assert.strictEqual(out.fingerprints.fp.firstSourceLine, undefined);
    });
});
