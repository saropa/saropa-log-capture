/**
 * Tests for cross-signal co-occurrence detection.
 * Validates Jaccard similarity calculation and pair filtering.
 */

import * as assert from 'assert';
import { detectCoOccurrences } from '../../../modules/misc/signal-co-occurrence';
import type { RecurringSignalEntry } from '../../../modules/misc/recurring-signal-builder';

function mockSignal(kind: string, fp: string, sessions: string[]): RecurringSignalEntry {
    return {
        kind: kind as RecurringSignalEntry['kind'],
        fingerprint: fp,
        label: `${kind}::${fp}`,
        sessionCount: sessions.length,
        totalOccurrences: sessions.length,
        firstSeen: sessions[0],
        lastSeen: sessions[sessions.length - 1],
        severity: 'medium',
        recurring: sessions.length >= 5,
        timeline: sessions.map(s => ({ session: s, count: 1 })),
    };
}

suite('SignalCoOccurrence', () => {

    test('should return empty for fewer than 2 qualifying signals', () => {
        const signals = [mockSignal('error', 'a', ['s1', 's2', 's3'])];
        assert.deepStrictEqual(detectCoOccurrences(signals), []);
    });

    test('should return empty when signals do not share enough sessions', () => {
        // Two signals in 3 sessions each, but no overlap
        const a = mockSignal('error', 'a', ['s1', 's2', 's3']);
        const b = mockSignal('sql', 'b', ['s4', 's5', 's6']);
        assert.deepStrictEqual(detectCoOccurrences([a, b]), []);
    });

    test('should detect co-occurring signals with high Jaccard', () => {
        // Both signals appear in the same 4 sessions — Jaccard = 1.0
        const sessions = ['s1', 's2', 's3', 's4'];
        const a = mockSignal('error', 'npe', sessions);
        const b = mockSignal('sql', 'slow-query', sessions);
        const result = detectCoOccurrences([a, b]);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].sharedSessions, 4);
        assert.ok(result[0].jaccard >= 0.99, 'jaccard should be ~1.0');
    });

    test('should skip pairs below Jaccard threshold (< 0.5)', () => {
        // a: sessions 1-5, b: sessions 3-7 → intersection {3,4,5} = 3, union = 7 → J ≈ 0.43
        const a = mockSignal('error', 'a', ['s1', 's2', 's3', 's4', 's5']);
        const b = mockSignal('sql', 'b', ['s3', 's4', 's5', 's6', 's7']);
        const result = detectCoOccurrences([a, b]);
        assert.strictEqual(result.length, 0, 'Jaccard 3/7 ≈ 0.43 — below 0.5 threshold');
    });

    test('should skip signals with fewer than 3 sessions', () => {
        const a = mockSignal('error', 'a', ['s1', 's2']);
        const b = mockSignal('sql', 'b', ['s1', 's2']);
        assert.deepStrictEqual(detectCoOccurrences([a, b]), []);
    });

    test('should sort pairs by Jaccard descending', () => {
        const sessions = ['s1', 's2', 's3', 's4', 's5'];
        const a = mockSignal('error', 'a', sessions);
        const b = mockSignal('sql', 'b', sessions);
        // c shares only 3 of 5 with a — lower Jaccard
        const c = mockSignal('warning', 'c', ['s1', 's2', 's3']);
        const result = detectCoOccurrences([a, b, c]);
        assert.ok(result.length >= 1);
        // First pair should be the highest Jaccard (a,b = 1.0)
        assert.ok(result[0].jaccard >= result[result.length - 1].jaccard);
    });
});
