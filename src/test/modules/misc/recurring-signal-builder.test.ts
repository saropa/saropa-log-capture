/**
 * Tests for the unified recurring signal builder — verifying that all metadata
 * sources (error/warning fingerprints, perf, SQL, signal counts, Drift Advisor)
 * are aggregated into a single RecurringSignalEntry[] list.
 */

import * as assert from 'assert';
import { buildAllRecurringSignals } from '../../../modules/misc/recurring-signal-builder';
import type { RecurringSignalEntry } from '../../../modules/misc/recurring-signal-builder';
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
        const fatal = result.find(s => s.fingerprint === 'error::fatal123');
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
        const sig = result.find(s => s.fingerprint === 'error::recur123');
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
        const sig = result.find(s => s.fingerprint === 'error::chrono12');
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
        const daIssues = result.find(s => s.fingerprint === 'classified::drift-advisor-issues');
        assert.ok(daIssues, 'should find Drift Advisor issues signal');
        assert.strictEqual(daIssues.totalOccurrences, 3);
        assert.ok(daIssues.detail?.includes('1 error'));
    });
});
