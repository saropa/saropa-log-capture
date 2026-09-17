/**
 * Tests for `api-signal-delta-window.ts` — the marker-boundary and file-split math behind
 * `getSignalDelta` (PLAN 119), exercised through an in-memory fake `PartReader` so they need
 * neither real disk I/O nor `vscode.workspace.fs`.
 *
 * This is the highest-risk arithmetic in the feature: an off-by-one here silently misattributes
 * signals across a marker or a split, and the reads are the ones that have to stay bounded on a
 * session large enough to matter. The `computeDelta` side — which slice is compared against which
 * — lives in `signal-delta.test.ts`, and the entry-point guards in `signal-delta-api.test.ts`.
 *
 * Runs standalone via `node --test out/test/api/signal-delta-window.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import {
    findEndOfSessionBound,
    readHistory,
    readWindow,
    type FileBound,
    type PartReader,
} from '../../api-signal-delta-window';

const noCap = Number.POSITIVE_INFINITY;

/** In-memory `PartReader` over a fixed set of parts, keyed by part number. */
function fakeReader(parts: readonly (readonly string[])[]): PartReader {
    return async (partNumber) => (partNumber < parts.length ? [...parts[partNumber]] : undefined);
}

function bound(partNumber: number, physicalLineIndex: number): FileBound {
    return { partNumber, physicalLineIndex };
}

// ---------------------------------------------------------------------------
// readWindow
// ---------------------------------------------------------------------------

test('readWindow: slices a single part between two physical-line indices', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2', 'l3', 'l4', 'l5']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 2), bound(0, 5), noCap), ['l2', 'l3', 'l4']);
});

test('readWindow: from the start of the session to a marker mid-file', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2', 'l3']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 0), bound(0, 2), noCap), ['l0', 'l1']);
});

test('readWindow: spans multiple parts, including full parts in between', async () => {
    const part0 = Array.from({ length: 10 }, (_, i) => `p0-${i}`);
    const part1 = ['p1-0', 'p1-1', 'p1-2', 'p1-3'];
    const part2 = ['p2-0', 'p2-1', 'p2-2', 'p2-3', 'p2-4'];
    const reader = fakeReader([part0, part1, part2]);
    const result = await readWindow(reader, bound(0, 8), bound(2, 3), noCap);
    assert.deepStrictEqual(result, ['p0-8', 'p0-9', 'p1-0', 'p1-1', 'p1-2', 'p1-3', 'p2-0', 'p2-1', 'p2-2']);
});

test('readWindow: empty when to equals from (no window)', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 1), bound(0, 1), noCap), []);
});

test('readWindow: empty when to is before from (misordered bounds)', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 2), bound(0, 0), noCap), []);
    assert.deepStrictEqual(await readWindow(reader, bound(1, 0), bound(0, 0), noCap), []);
});

test('readWindow: a missing middle part (rotated/deleted) is skipped, not a hard failure', async () => {
    const reader: PartReader = async (p) => {
        if (p === 0) { return ['p0-0', 'p0-1']; }
        if (p === 2) { return ['p2-0', 'p2-1']; }
        return undefined; // part 1 missing
    };
    assert.deepStrictEqual(await readWindow(reader, bound(0, 0), bound(2, 2), noCap), ['p0-0', 'p0-1', 'p2-0', 'p2-1']);
});

test('readWindow: an end bound past the real length of a part clamps to it', async () => {
    // The "now" bound comes from a live counter incremented before the stream flushes, so it can
    // legitimately name a line the file does not hold yet.
    const reader = fakeReader([['l0', 'l1']]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 0), bound(0, 99), noCap), ['l0', 'l1']);
});

test('readWindow: truncates to maxLines keeping the earliest lines', async () => {
    const reader = fakeReader([Array.from({ length: 20 }, (_, i) => `l${i}`)]);
    assert.deepStrictEqual(await readWindow(reader, bound(0, 5), bound(0, 20), 3), ['l5', 'l6', 'l7']);
});

test('readWindow: a part larger than the spread-apply argument limit does not throw', async () => {
    // Regression: `push(...lines.slice(...))` throws RangeError somewhere past ~125k arguments,
    // and `maxLines` defaults to 100,000 COUNTED lines while physical lines (header, DAP, markers)
    // are excluded from that count — so a single real part can hold well past the limit.
    const huge = new Array(250_000).fill('some log line');
    const reader = fakeReader([huge]);
    const result = await readWindow(reader, bound(0, 0), bound(0, huge.length), noCap);
    assert.strictEqual(result.length, 250_000);
});

// ---------------------------------------------------------------------------
// readHistory
// ---------------------------------------------------------------------------

test('readHistory: reads backwards from the bound and keeps the most recent lines', async () => {
    const reader = fakeReader([Array.from({ length: 10 }, (_, i) => `l${i}`)]);
    assert.deepStrictEqual(await readHistory(reader, bound(0, 8), 3), ['l5', 'l6', 'l7']);
});

test('readHistory: returns everything before the bound when under the cap', async () => {
    const reader = fakeReader([['l0', 'l1', 'l2', 'l3']]);
    assert.deepStrictEqual(await readHistory(reader, bound(0, 3), 50), ['l0', 'l1', 'l2']);
});

test('readHistory: walks back across parts in original order', async () => {
    const reader = fakeReader([['a0', 'a1'], ['b0', 'b1'], ['c0', 'c1', 'c2']]);
    assert.deepStrictEqual(await readHistory(reader, bound(2, 2), 50), ['a0', 'a1', 'b0', 'b1', 'c0', 'c1']);
});

test('readHistory: stops reading once the cap is met, without touching older parts', async () => {
    const touched: number[] = [];
    const parts = [['a0', 'a1'], ['b0', 'b1'], ['c0', 'c1']];
    const reader: PartReader = async (p) => {
        touched.push(p);
        return p < parts.length ? [...parts[p]] : undefined;
    };
    assert.deepStrictEqual(await readHistory(reader, bound(2, 2), 2), ['c0', 'c1']);
    assert.deepStrictEqual(touched, [2], 'older parts must not be read once the cap is satisfied');
});

test('readHistory: empty at the very start of a session', async () => {
    const reader = fakeReader([['l0', 'l1']]);
    assert.deepStrictEqual(await readHistory(reader, bound(0, 0), 50), []);
});

test('readHistory: skips a missing part rather than stopping at it', async () => {
    const reader: PartReader = async (p) => {
        if (p === 0) { return ['a0', 'a1']; }
        if (p === 2) { return ['c0', 'c1']; }
        return undefined; // part 1 missing
    };
    assert.deepStrictEqual(await readHistory(reader, bound(2, 2), 50), ['a0', 'a1', 'c0', 'c1']);
});

test('readHistory: stops rather than probing every part back to zero', async () => {
    // Retention deletes the oldest parts first, so a long run of missing parts means that history
    // is gone. Walking all the way to part 0 would be an unbounded pile of failed reads.
    const probed: number[] = [];
    const reader: PartReader = async (p) => {
        probed.push(p);
        return p === 40 ? ['tail'] : undefined; // parts 0..39 deleted by retention
    };
    assert.deepStrictEqual(await readHistory(reader, bound(40, 1), 50), ['tail']);
    assert.ok(probed.length <= 6, `probe should be bounded, made ${probed.length} reads`);
});

test('readHistory: a huge part does not throw on the spread-apply limit', async () => {
    const reader = fakeReader([new Array(250_000).fill('x')]);
    const result = await readHistory(reader, bound(0, 250_000), 200_000);
    assert.strictEqual(result.length, 200_000);
});

// ---------------------------------------------------------------------------
// findEndOfSessionBound
// ---------------------------------------------------------------------------

test('findEndOfSessionBound: stops at the last existing part and its line count', async () => {
    const reader = fakeReader([['a', 'b'], ['c', 'd', 'e'], ['f']]);
    assert.deepStrictEqual(await findEndOfSessionBound(reader, 0), { partNumber: 2, physicalLineIndex: 1 });
});

test('findEndOfSessionBound: a single-part session resolves to that part\'s own length', async () => {
    const reader = fakeReader([['only', 'two', 'lines']]);
    assert.deepStrictEqual(await findEndOfSessionBound(reader, 0), { partNumber: 0, physicalLineIndex: 3 });
});

test('findEndOfSessionBound: starting past the last part falls back to fromPart with zero lines', async () => {
    const reader = fakeReader([['a']]);
    assert.deepStrictEqual(await findEndOfSessionBound(reader, 5), { partNumber: 5, physicalLineIndex: 0 });
});

test('findEndOfSessionBound: steps over a gap, matching readWindow\'s skip policy', async () => {
    // An explicit window already spans a hole in the part sequence; an implicit "now" bound that
    // stopped dead at the same hole would silently shorten the window instead.
    const reader: PartReader = async (p) => {
        if (p === 0) { return ['a']; }
        if (p === 2) { return ['c0', 'c1']; }
        return undefined;
    };
    assert.deepStrictEqual(await findEndOfSessionBound(reader, 0), { partNumber: 2, physicalLineIndex: 2 });
});

test('findEndOfSessionBound: does not probe forever past the real end', async () => {
    let highestProbed = -1;
    const reader: PartReader = async (p) => {
        highestProbed = Math.max(highestProbed, p);
        return p === 0 ? ['a'] : undefined;
    };
    assert.deepStrictEqual(await findEndOfSessionBound(reader, 0), { partNumber: 0, physicalLineIndex: 1 });
    assert.ok(highestProbed <= 5, `probe should be bounded, reached part ${highestProbed}`);
});
