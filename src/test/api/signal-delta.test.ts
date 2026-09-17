/**
 * Tests for the pure diffing step behind `getSignalDelta` (PLAN 119). File I/O (reading marker
 * windows off disk, resolving "now") and the line scanners themselves (they read `vscode`
 * config to classify error/warning lines) need the real extension host and are exercised by
 * suite-style tests instead; this pins the hash/name diffing that decides new vs resolved.
 *
 * Runs standalone via `node --test out/test/api/signal-delta.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { diffFingerprints, diffPerf } from '../../api-signal-delta';
import type { FingerprintEntry } from '../../modules/analysis/error-fingerprint';
import type { PerfFingerprintEntry } from '../../modules/misc/perf-fingerprint';

function fp(over: Partial<FingerprintEntry>): FingerprintEntry {
    return { h: 'aaaa1111', n: 'normalized', e: 'example line', c: 1, ...over };
}

function perf(over: Partial<PerfFingerprintEntry>): PerfFingerprintEntry {
    return { name: 'op', avgMs: 10, minMs: 5, maxMs: 15, count: 1, ...over };
}

test('diffFingerprints: reports entries in after not present in before', () => {
    const before = [fp({ h: 'h1' })];
    const after = [fp({ h: 'h1' }), fp({ h: 'h2', n: 'new one', e: 'boom' })];
    const result = diffFingerprints(before, after, 'error');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].label, 'new one');
    assert.strictEqual(result[0].detail, 'boom');
    assert.deepStrictEqual(result[0].args, { id: 'error:h2' });
    assert.strictEqual(result[0].command, 'saropaLogCapture.openSignal');
});

test('diffFingerprints: empty when after is a subset of before', () => {
    const before = [fp({ h: 'h1' }), fp({ h: 'h2' })];
    const after = [fp({ h: 'h1' })];
    assert.deepStrictEqual(diffFingerprints(before, after, 'error'), []);
});

test('diffFingerprints: resolved direction is just the diff called the other way', () => {
    const before = [fp({ h: 'h1' }), fp({ h: 'h2' })];
    const after = [fp({ h: 'h1' })];
    // "resolved" = present in before, gone from after = diff(after, before)
    const resolved = diffFingerprints(after, before, 'warning');
    assert.strictEqual(resolved.length, 1);
    assert.deepStrictEqual(resolved[0].args, { id: 'warning:h2' });
});

test('diffFingerprints: same hash with a different example line is still a match (not new)', () => {
    const before = [fp({ h: 'h1', e: 'first example' })];
    const after = [fp({ h: 'h1', e: 'second example' })];
    assert.deepStrictEqual(diffFingerprints(before, after, 'error'), []);
});

test('diffPerf: keys by operation name, not by any hash', () => {
    const before = [perf({ name: 'slowOp' })];
    const after = [perf({ name: 'slowOp' }), perf({ name: 'newOp', count: 3, avgMs: 42 })];
    const result = diffPerf(before, after);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].label, 'newOp');
    assert.strictEqual(result[0].detail, '3 occurrences, avg 42ms');
    assert.deepStrictEqual(result[0].args, { id: 'perf:newOp' });
});

test('diffPerf: singularizes a single occurrence', () => {
    const result = diffPerf([], [perf({ name: 'onceOnly', count: 1, avgMs: 7 })]);
    assert.strictEqual(result[0].detail, '1 occurrence, avg 7ms');
});
