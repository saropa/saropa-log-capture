/**
 * Tests for the unified recurring signal builder — verifying that all metadata
 * sources (error/warning fingerprints, perf, SQL, signal counts, Drift Advisor)
 * are aggregated into a single RecurringSignalEntry[] list.
 */

import * as assert from 'assert';
import { buildAllRecurringSignals } from '../../../modules/misc/recurring-signal-builder';
import type { LoadedMeta } from '../../../modules/session/metadata-loader';
import type { SessionMeta } from '../../../modules/session/session-metadata';

function mockMeta(filename: string, overrides?: Partial<SessionMeta>): LoadedMeta {
    return { filename, meta: { ...overrides } };
}

suite('RecurringSignalBuilder', () => {

    test('should return empty array for no metas', () => {
        const result = buildAllRecurringSignals([]);
        assert.strictEqual(result.length, 0);
    });

    test('should create error signals from fingerprints', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                fingerprints: [{ h: 'abc12345', n: 'NullPointerException', e: 'Error: NPE at main', c: 3, cat: 'non-fatal' }],
            }),
            mockMeta('20260402_100000.log', {
                fingerprints: [{ h: 'abc12345', n: 'NullPointerException', e: 'Error: NPE at main', c: 5 }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const npe = result.find(s => s.kind === 'error' && s.label === 'NullPointerException');
        assert.ok(npe, 'should find the NullPointerException error signal');
        assert.strictEqual(npe.sessionCount, 2);
        assert.strictEqual(npe.totalOccurrences, 8);
    });

    test('should create warning signals from warning fingerprints', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                warningFingerprints: [{ h: 'warn1234', n: 'deprecated API call', e: 'Warning: deprecated', c: 7 }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const warn = result.find(s => s.kind === 'warning');
        assert.ok(warn, 'should find a warning signal');
        assert.strictEqual(warn.totalOccurrences, 7);
    });

    test('should create perf signals with duration stats', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                perfFingerprints: [{ name: 'dbQuery', avgMs: 100, minMs: 50, maxMs: 200, count: 10 }],
            }),
            mockMeta('20260402_100000.log', {
                perfFingerprints: [{ name: 'dbQuery', avgMs: 150, minMs: 80, maxMs: 300, count: 5 }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const perf = result.find(s => s.kind === 'perf' && s.label === 'dbQuery');
        assert.ok(perf, 'should find the dbQuery perf signal');
        assert.strictEqual(perf.sessionCount, 2);
        assert.strictEqual(perf.totalOccurrences, 15);
        assert.strictEqual(perf.maxDurationMs, 300);
        // Weighted avg: (100*10 + 150*5) / 15 = 1750/15 ≈ 117
        assert.ok(perf.avgDurationMs !== undefined && perf.avgDurationMs > 0);
    });

    test('should classify severity correctly', () => {
        // Fatal error → critical
        const metas = [
            mockMeta('20260401_100000.log', {
                fingerprints: [{ h: 'fatal123', n: 'FATAL', e: 'FATAL ERROR', c: 1, cat: 'fatal' }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        // Fingerprint is the raw hash — kind:: prefix was stripped in rankSignals
        const fatal = result.find(s => s.kind === 'error' && s.fingerprint === 'fatal123');
        assert.ok(fatal);
        assert.strictEqual(fatal.severity, 'critical');
    });

    test('should flag signals in 5+ sessions as recurring', () => {
        // Same error fingerprint in 6 sessions
        const metas = Array.from({ length: 6 }, (_, i) =>
            mockMeta(`2026040${i + 1}_100000.log`, {
                fingerprints: [{ h: 'recur123', n: 'recurring error', e: 'Error: recur', c: 1 }],
            }),
        );
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.kind === 'error' && s.fingerprint === 'recur123');
        assert.ok(sig);
        assert.strictEqual(sig.recurring, true);
        assert.strictEqual(sig.sessionCount, 6);
        assert.strictEqual(sig.severity, 'high'); // error in 5+ sessions → high
    });

    test('should sort critical signals first', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                fingerprints: [
                    { h: 'low12345', n: 'minor error', e: 'err', c: 100 }, // Non-fatal, 1 session → medium
                    { h: 'fat12345', n: 'fatal crash', e: 'FATAL', c: 1, cat: 'fatal' }, // Fatal → critical
                ],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        // Critical should come before medium regardless of occurrence count
        assert.strictEqual(result[0].severity, 'critical');
    });

    test('should set firstSeen/lastSeen chronologically', () => {
        // Insert metas in reverse order to test sorting
        const metas = [
            mockMeta('20260403_100000.log', {
                fingerprints: [{ h: 'chrono12', n: 'chrono err', e: 'err', c: 1 }],
            }),
            mockMeta('20260401_100000.log', {
                fingerprints: [{ h: 'chrono12', n: 'chrono err', e: 'err', c: 1 }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.fingerprint === 'chrono12');
        assert.ok(sig);
        // firstSeen should be the earlier session, lastSeen the later — regardless of insertion order
        assert.ok(sig.firstSeen.includes('20260401'), `firstSeen should be 0401 but was ${sig.firstSeen}`);
        assert.ok(sig.lastSeen.includes('20260403'), `lastSeen should be 0403 but was ${sig.lastSeen}`);
    });

    test('should include Drift Advisor issues as classified signals', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                integrations: {
                    'saropa-drift-advisor': {
                        issuesSummary: { count: 3, bySeverity: { error: 1, warning: 2 } },
                        performance: { topSlow: [] },
                    },
                },
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        // Fingerprint is the raw identifier — kind:: prefix was stripped in rankSignals
        const daIssues = result.find(s => s.kind === 'classified' && s.fingerprint === 'drift-advisor-issues');
        assert.ok(daIssues, 'should find Drift Advisor issues signal');
        assert.strictEqual(daIssues.totalOccurrences, 3);
        assert.ok(daIssues.detail?.includes('1 error'));
    });

    test('should track app version as firstSeenVersion/lastSeenVersion', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                appVersion: '1.0.0',
                fingerprints: [{ h: 'ver12345', n: 'version test', e: 'Error: ver', c: 1 }],
            }),
            mockMeta('20260403_100000.log', {
                appVersion: '1.2.0',
                fingerprints: [{ h: 'ver12345', n: 'version test', e: 'Error: ver', c: 1 }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.fingerprint === 'ver12345');
        assert.ok(sig);
        assert.strictEqual(sig.firstSeenVersion, '1.0.0');
        assert.strictEqual(sig.lastSeenVersion, '1.2.0');
    });

    test('should compute trend as increasing when newer sessions have more occurrences', () => {
        // 5 sessions: older 3 have 1 each, newer 2 have 10 each → increasing
        const metas = [
            mockMeta('20260401_100000.log', { fingerprints: [{ h: 'trend01', n: 'trend', e: 'err', c: 1 }] }),
            mockMeta('20260402_100000.log', { fingerprints: [{ h: 'trend01', n: 'trend', e: 'err', c: 1 }] }),
            mockMeta('20260403_100000.log', { fingerprints: [{ h: 'trend01', n: 'trend', e: 'err', c: 1 }] }),
            mockMeta('20260404_100000.log', { fingerprints: [{ h: 'trend01', n: 'trend', e: 'err', c: 10 }] }),
            mockMeta('20260405_100000.log', { fingerprints: [{ h: 'trend01', n: 'trend', e: 'err', c: 10 }] }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.fingerprint === 'trend01');
        assert.ok(sig);
        assert.strictEqual(sig.trend, 'increasing');
    });

    test('should compute trend as undefined for fewer than 3 sessions', () => {
        const metas = [
            mockMeta('20260401_100000.log', { fingerprints: [{ h: 'few123', n: 'few', e: 'err', c: 5 }] }),
            mockMeta('20260402_100000.log', { fingerprints: [{ h: 'few123', n: 'few', e: 'err', c: 5 }] }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.fingerprint === 'few123');
        assert.ok(sig);
        assert.strictEqual(sig.trend, undefined);
    });

    test('should strip kind:: prefix from fingerprint output', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                fingerprints: [{ h: 'rawHash1', n: 'test', e: 'err', c: 1 }],
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.kind === 'error');
        assert.ok(sig);
        // Fingerprint should be the raw hash, not "error::rawHash1"
        assert.strictEqual(sig.fingerprint, 'rawHash1');
        assert.ok(!sig.fingerprint.includes('::'), 'fingerprint should not contain :: prefix');
    });

    test('should aggregate V2 entry durations across sessions via weighted average', () => {
        // Two sessions with the same slow-op, different durations — weighted avg should combine
        const metas = [
            mockMeta('20260401_100000.log', {
                signalSummary: {
                    schemaVersion: 2, counts: { slowOperations: 2 },
                    entries: [{ kind: 'slow-op', fingerprint: 'dbQuery', label: 'dbQuery', count: 2, avgDurationMs: 100, maxDurationMs: 150 }],
                },
            }),
            mockMeta('20260402_100000.log', {
                signalSummary: {
                    schemaVersion: 2, counts: { slowOperations: 3 },
                    entries: [{ kind: 'slow-op', fingerprint: 'dbQuery', label: 'dbQuery', count: 3, avgDurationMs: 200, maxDurationMs: 400 }],
                },
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.kind === 'slow-op' && s.fingerprint === 'dbQuery');
        assert.ok(sig, 'should find dbQuery slow-op signal');
        assert.strictEqual(sig.totalOccurrences, 5);
        // Weighted avg: (100*2 + 200*3) / 5 = 800/5 = 160
        assert.strictEqual(sig.avgDurationMs, 160);
        // Max should be the highest across both sessions
        assert.strictEqual(sig.maxDurationMs, 400);
    });

    test('should propagate lineIndices from V2 entries', () => {
        const metas = [
            mockMeta('20260401_100000.log', {
                signalSummary: {
                    schemaVersion: 2, counts: { networkFailures: 1 },
                    entries: [{ kind: 'network', fingerprint: 'SocketException', label: 'SocketException', count: 1, lineIndices: [42, 99] }],
                },
            }),
        ];
        const result = buildAllRecurringSignals(metas);
        const sig = result.find(s => s.kind === 'network');
        assert.ok(sig, 'should find network signal');
        assert.ok(sig.lineIndices, 'should have lineIndices');
        assert.deepStrictEqual(sig.lineIndices, [42, 99]);
    });
});
