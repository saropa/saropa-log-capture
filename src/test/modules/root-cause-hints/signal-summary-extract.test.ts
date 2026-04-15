/**
 * Tests for signal summary extraction — verifying that a RootCauseHintBundle
 * is correctly compressed into a compact PersistedSignalSummaryV2.
 */

import * as assert from 'assert';
import { extractSignalSummary } from '../../../modules/root-cause-hints/signal-summary-extract';
import type { RootCauseHintBundle, RootCauseHypothesis } from '../../../modules/root-cause-hints/root-cause-hint-types';

function emptyBundle(): RootCauseHintBundle {
    return { bundleVersion: 2, sessionId: 'test|session' };
}

function mockHypothesis(templateId: string): RootCauseHypothesis {
    return { templateId, text: `Signal: ${templateId}`, evidenceLineIds: [1], confidence: 'medium', hypothesisKey: `key::${templateId}` };
}

suite('SignalSummaryExtract', () => {

    test('should return undefined for empty bundle with no signals', () => {
        const result = extractSignalSummary(emptyBundle(), []);
        assert.strictEqual(result, undefined);
    });

    test('should count errors from bundle', () => {
        const bundle: RootCauseHintBundle = {
            ...emptyBundle(),
            errors: [
                { lineIndex: 0, excerpt: 'Error: test' },
                { lineIndex: 5, excerpt: 'Error: other' },
            ],
        };
        const result = extractSignalSummary(bundle, []);
        assert.ok(result);
        assert.strictEqual(result.counts.errors, 2);
        assert.strictEqual(result.schemaVersion, 2);
    });

    test('should extract hypothesis template IDs (max 5)', () => {
        const hypotheses = ['a', 'b', 'c', 'd', 'e', 'f'].map(mockHypothesis);
        const bundle: RootCauseHintBundle = {
            ...emptyBundle(),
            errors: [{ lineIndex: 0, excerpt: 'err' }],
        };
        const result = extractSignalSummary(bundle, hypotheses);
        assert.ok(result);
        assert.ok(result.hypothesisTemplateIds);
        // Capped at 5 even though 6 hypotheses were provided
        assert.strictEqual(result.hypothesisTemplateIds.length, 5);
    });

    test('should extract ANR risk level', () => {
        const bundle: RootCauseHintBundle = {
            ...emptyBundle(),
            anrRisk: { score: 50, level: 'high', signals: ['jank'] },
        };
        const result = extractSignalSummary(bundle, []);
        assert.ok(result);
        assert.strictEqual(result.anrRiskLevel, 'high');
    });

    test('should extract top N+1 fingerprints sorted by repeats', () => {
        const bundle: RootCauseHintBundle = {
            ...emptyBundle(),
            nPlusOneHints: [
                { lineIndex: 0, fingerprint: 'fp-low', repeats: 3, distinctArgs: 2, windowSpanMs: 100, confidence: 'medium' },
                { lineIndex: 1, fingerprint: 'fp-high', repeats: 10, distinctArgs: 5, windowSpanMs: 200, confidence: 'high' },
                { lineIndex: 2, fingerprint: 'fp-mid', repeats: 5, distinctArgs: 3, windowSpanMs: 150, confidence: 'medium' },
            ],
        };
        const result = extractSignalSummary(bundle, []);
        assert.ok(result);
        assert.ok(result.topNPlusOneFingerprints);
        // Sorted by repeats descending — fp-high first
        assert.strictEqual(result.topNPlusOneFingerprints[0], 'fp-high');
        assert.strictEqual(result.topNPlusOneFingerprints.length, 3);
    });

    test('should extract top slow operation names sorted by duration', () => {
        const bundle: RootCauseHintBundle = {
            ...emptyBundle(),
            slowOperations: [
                { lineIndex: 0, excerpt: 'slow1', durationMs: 100, operationName: 'opA' },
                { lineIndex: 1, excerpt: 'slow2', durationMs: 500, operationName: 'opB' },
                { lineIndex: 2, excerpt: 'slow3', durationMs: 50 }, // No operationName — excluded
            ],
        };
        const result = extractSignalSummary(bundle, []);
        assert.ok(result);
        assert.ok(result.topSlowOps);
        // opB (500ms) should be first, opA (100ms) second
        assert.strictEqual(result.topSlowOps[0], 'opB');
        assert.strictEqual(result.topSlowOps[1], 'opA');
        assert.strictEqual(result.topSlowOps.length, 2);
    });

    test('should count all signal types from bundle', () => {
        const bundle: RootCauseHintBundle = {
            ...emptyBundle(),
            warningGroups: [{ excerpt: 'warn', count: 3, lineIndices: [1] }],
            networkFailures: [{ lineIndex: 0, excerpt: 'net', pattern: 'socket' }],
            memoryEvents: [{ lineIndex: 0, excerpt: 'oom' }],
            slowOperations: [{ lineIndex: 0, excerpt: 'slow', durationMs: 100 }],
            permissionDenials: [{ lineIndex: 0, excerpt: 'perm' }],
            classifiedErrors: [{ lineIndex: 0, excerpt: 'bug', classification: 'bug' }],
        };
        const result = extractSignalSummary(bundle, []);
        assert.ok(result);
        assert.strictEqual(result.counts.warningGroups, 1);
        assert.strictEqual(result.counts.networkFailures, 1);
        assert.strictEqual(result.counts.memoryEvents, 1);
        assert.strictEqual(result.counts.slowOperations, 1);
        assert.strictEqual(result.counts.permissionDenials, 1);
        assert.strictEqual(result.counts.classifiedErrors, 1);
    });
});
