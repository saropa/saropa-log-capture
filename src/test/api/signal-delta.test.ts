/**
 * Tests for the pure logic behind `getSignalDelta` (PLAN 119):
 *  - the hash/name diffing that decides new vs resolved signals
 *  - `readWindow`/`findEndOfSessionBound`, the marker-boundary and file-split math — the
 *    highest-risk part of this feature, exercised here via an in-memory fake `PartReader` so it
 *    doesn't need real disk I/O or the `vscode.workspace.fs` API.
 *
 * The line scanners themselves (they read `vscode` config to classify error/warning lines) and
 * the real disk-backed `PartReader` need the actual extension host and are exercised by
 * suite-style tests instead.
 *
 * Runs standalone via `node --test out/test/api/signal-delta.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { diffFingerprints, diffPerf, readWindow, findEndOfSessionBound, type PartReader, type FileBound } from '../../api-signal-delta';
import type { FingerprintEntry } from '../../modules/analysis/error-fingerprint';
import type { PerfFingerprintEntry } from '../../modules/misc/perf-fingerprint';

/** In-memory `PartReader` over a fixed set of parts, keyed by part number. */
function fakeReader(parts: readonly (readonly string[])[]): PartReader {
    return async (partNumber) => (partNumber < parts.length ? [...parts[partNumber]] : undefined);
}

function bound(partNumber: number, physicalLineIndex: number): FileBound {
    return { partNumber, physicalLineIndex };
}

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

test('readWindow: slices a single part between two physical-line indices', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2', 'l3', 'l4', 'l5']]);
    const result = await readWindow(reader, bound(0, 2), bound(0, 5));
    assert.deepStrictEqual(result, ['l2', 'l3', 'l4']);
});

test('readWindow: from the start of the session to a marker mid-file', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2', 'l3']]);
    const result = await readWindow(reader, bound(0, 0), bound(0, 2));
    assert.deepStrictEqual(result, ['l0', 'l1']);
});

test('readWindow: spans multiple parts, including full parts in between', async () => {
    // part 0: 10 lines, marker at physical line 8 (lines 8-9 are "after"); part 1: full 4-line
    // part; part 2: marker at physical line 3 (only its first 3 lines are "after").
    const part0 = Array.from({ length: 10 }, (_, i) => `p0-${i}`);
    const part1 = ['p1-0', 'p1-1', 'p1-2', 'p1-3'];
    const part2 = ['p2-0', 'p2-1', 'p2-2', 'p2-3', 'p2-4'];
    const reader = fakeReader([part0, part1, part2]);
    const result = await readWindow(reader, bound(0, 8), bound(2, 3));
    assert.deepStrictEqual(result, ['p0-8', 'p0-9', 'p1-0', 'p1-1', 'p1-2', 'p1-3', 'p2-0', 'p2-1', 'p2-2']);
});

test('readWindow: empty when to equals from (no window)', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 1), bound(0, 1)), []);
});

test('readWindow: empty when to is before from (misordered bounds)', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 2), bound(0, 0)), []);
    assert.deepStrictEqual(await readWindow(reader, bound(1, 0), bound(0, 0)), []);
});

test('readWindow: a missing middle part (rotated/deleted) is skipped, not a hard failure', async () => {
    const part0 = ['p0-0', 'p0-1'];
    const part2 = ['p2-0', 'p2-1'];
    const reader: PartReader = async (p) => {
        if (p === 0) { return [...part0]; }
        if (p === 2) { return [...part2]; }
        return undefined; // part 1 missing
    };
    const result = await readWindow(reader, bound(0, 0), bound(2, 2));
    assert.deepStrictEqual(result, ['p0-0', 'p0-1', 'p2-0', 'p2-1']);
});

test('findEndOfSessionBound: stops at the last existing part and its line count', async () => {
    const reader = fakeReader([['a', 'b'], ['c', 'd', 'e'], ['f']]);
    const result = await findEndOfSessionBound(reader, 0);
    assert.deepStrictEqual(result, { partNumber: 2, physicalLineIndex: 1 });
});

test('findEndOfSessionBound: a single-part session resolves to that part\'s own length', async () => {
    const reader = fakeReader([['only', 'two', 'lines']]);
    const result = await findEndOfSessionBound(reader, 0);
    assert.deepStrictEqual(result, { partNumber: 0, physicalLineIndex: 3 });
});

test('findEndOfSessionBound: starting past the last part falls back to fromPart with zero lines', async () => {
    const reader = fakeReader([['a']]);
    const result = await findEndOfSessionBound(reader, 5);
    assert.deepStrictEqual(result, { partNumber: 5, physicalLineIndex: 0 });
});
