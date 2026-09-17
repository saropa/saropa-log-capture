/**
 * Tests for `api-signal-delta.ts` (PLAN 119):
 *  - `computeDelta`, which decides WHICH slice is compared against which — the part that makes
 *    "new" and "resolved" mean what the API says they mean
 *  - the hash/name diffing underneath it
 *
 * The boundary/split arithmetic those sit on lives in `signal-delta-window.test.ts`, and the
 * entry-point guards in `signal-delta-api.test.ts`.
 *
 * `computeDelta` is covered twice over: once with an injected scanner (so the slicing decisions
 * are asserted exactly, independent of line classification), and once end-to-end through the real
 * `vscode`-backed scanners, so the fake cannot quietly drift from the production scan.
 *
 * Runs standalone via `node --test out/test/api/signal-delta.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import {
    computeDelta,
    diffFingerprints,
    diffPerf,
    type LineScanner,
    type ScannedSignals,
} from '../../api-signal-delta';
import type { FileBound, PartReader } from '../../api-signal-delta-window';
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

/**
 * Scanner that treats each distinct line as its own error fingerprint, so a test can assert
 * exactly which LINES ended up on each side of the comparison rather than which signals were
 * classified. Groups by line the way the real scanners group by hash — one entry per distinct
 * signal with an occurrence count, not one per occurrence.
 */
const lineIdentityScanner: LineScanner = (lines) => {
    const counts = new Map<string, number>();
    for (const line of lines) { counts.set(line, (counts.get(line) ?? 0) + 1); }
    return {
        errors: [...counts].map(([line, c]) => fp({ h: line, n: line, e: line, c })),
        warnings: [],
        perf: [],
    };
};

function labels(items: readonly { readonly label: string }[]): string[] {
    return items.map((i) => i.label).sort();
}

// ---------------------------------------------------------------------------
// diffing
// ---------------------------------------------------------------------------

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
    assert.deepStrictEqual(diffFingerprints(before, [fp({ h: 'h1' })], 'error'), []);
});

test('diffFingerprints: resolved direction is just the diff called the other way', () => {
    const before = [fp({ h: 'h1' }), fp({ h: 'h2' })];
    const resolved = diffFingerprints([fp({ h: 'h1' })], before, 'warning');
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

// ---------------------------------------------------------------------------
// computeDelta — which slice is compared against which
// ---------------------------------------------------------------------------

test('computeDelta: new signals are those absent from all prior history', async () => {
    const reader = fakeReader([['old', 'old', 'shared', 'fresh', 'shared']]);
    const delta = await computeDelta(reader, bound(0, 3), bound(0, 5), lineIdentityScanner);
    assert.deepStrictEqual(labels(delta.newSignals), ['fresh']);
});

test('computeDelta: an empty window resolves nothing — no output is no evidence', async () => {
    // The degenerate case that matters most in practice: a bracketed command that logs nothing.
    // Comparing the window against the whole session would report every prior signal as resolved.
    const history = Array.from({ length: 40 }, (_, i) => `err${i}`);
    const reader = fakeReader([history]);
    const delta = await computeDelta(reader, bound(0, 40), bound(0, 40), lineIdentityScanner);
    assert.deepStrictEqual(delta.resolvedSignals, []);
    assert.deepStrictEqual(delta.newSignals, []);
});

test('computeDelta: resolved compares against an equal-length baseline, not the whole session', async () => {
    // 'ancient' stopped long before the marker, so the run cannot have resolved it; 'recent' was
    // still going right up to the marker and stops inside the window, so it did.
    const lines = ['ancient', 'ancient', 'recent', 'recent', 'quiet', 'quiet'];
    const reader = fakeReader([lines]);
    // Window is 2 lines, so the baseline is the 2 lines immediately before the marker.
    const delta = await computeDelta(reader, bound(0, 4), bound(0, 6), lineIdentityScanner);
    assert.deepStrictEqual(labels(delta.resolvedSignals), ['recent']);
});

test('computeDelta: a signal that keeps occurring inside the window is not resolved', async () => {
    const reader = fakeReader([['noisy', 'noisy', 'noisy', 'noisy']]);
    const delta = await computeDelta(reader, bound(0, 2), bound(0, 4), lineIdentityScanner);
    assert.deepStrictEqual(delta.resolvedSignals, []);
});

test('computeDelta: history and window are both read across a file split', async () => {
    // Marker sits at the end of part 0, window runs into part 1. Both directions must cross it:
    // 'shared' is only "not new" if the backwards history read reached part 0, and 'stopped' is
    // only resolved if the baseline was drawn from part 0 too.
    const reader = fakeReader([['stopped', 'shared'], ['shared', 'fresh']]);
    const delta = await computeDelta(reader, bound(0, 2), bound(1, 2), lineIdentityScanner);
    assert.deepStrictEqual(labels(delta.newSignals), ['fresh']);
    assert.deepStrictEqual(labels(delta.resolvedSignals), ['stopped']);
});

test('computeDelta: a window starting at session start has no history to compare against', async () => {
    const reader = fakeReader([['first', 'second']]);
    const delta = await computeDelta(reader, bound(0, 0), bound(0, 2), lineIdentityScanner);
    assert.deepStrictEqual(labels(delta.newSignals), ['first', 'second']);
    assert.deepStrictEqual(delta.resolvedSignals, []);
});

// ---------------------------------------------------------------------------
// computeDelta — end to end through the real scanners
// ---------------------------------------------------------------------------

test('computeDelta (real scanners): a genuinely new error is reported as new', async () => {
    const lines = [
        'ERROR: alpha connection refused',
        'ERROR: alpha connection refused',
        'ERROR: beta null pointer',
    ];
    const reader = fakeReader([lines]);
    const delta = await computeDelta(reader, bound(0, 2), bound(0, 3));
    assert.strictEqual(delta.newSignals.length, 1);
    assert.ok(delta.newSignals[0].label.includes('beta'));
});

test('computeDelta (real scanners): an error outside the presentation rank cap is not "new"', async () => {
    // Regression: the scanners cap their output at the top 30 fingerprints by frequency. The
    // "before" side saturates that cap on any busy session, so a rare error that DID occur before
    // the marker went missing from it and reported as newly introduced on its next occurrence.
    const lines: string[] = [];
    for (let i = 0; i < 30; i++) {
        for (let k = 0; k < 5; k++) { lines.push(`ERROR: alpha${i} broke`); }
    }
    lines.push('ERROR: rare zeta broke');
    const sinceIdx = lines.length;
    lines.push('ERROR: rare zeta broke');

    const reader = fakeReader([lines]);
    const delta = await computeDelta(reader, bound(0, sinceIdx), bound(0, lines.length));
    assert.deepStrictEqual(delta.newSignals, [], 'the rare error already occurred before the marker');
});

test('computeDelta (real scanners): history past the per-scanner line cap still counts as "before"', async () => {
    // Regression: the perf scanner's own line cap is 5,000 — a tenth of the shared MAX_SCAN_LINES
    // — so a "before" slice longer than that was scanned only from its opening lines. A perf
    // operation that had in fact been running all along went missing from the comparison and
    // reported as introduced by the bracketed command. The signal sits deliberately past line
    // 5,000 of the history slice, where the unlifted cap cannot see it.
    const lines: string[] = [];
    for (let i = 0; i < 5_500; i++) { lines.push(`plain chatter line ${i}`); }
    lines.push('[log] PERF loadProfile: 1200ms');
    const sinceIdx = lines.length;
    lines.push('[log] PERF loadProfile: 1250ms');

    const reader = fakeReader([lines]);
    const delta = await computeDelta(reader, bound(0, sinceIdx), bound(0, lines.length));
    assert.deepStrictEqual(delta.newSignals, [], 'loadProfile already ran before the marker, past line 5,000');
});

test('computeDelta (real scanners): an empty window still resolves nothing', async () => {
    const lines = Array.from({ length: 40 }, (_, i) => `ERROR: widget ${i} failed to load`);
    const reader = fakeReader([lines]);
    const delta = await computeDelta(reader, bound(0, 40), bound(0, 40));
    assert.deepStrictEqual(delta.resolvedSignals, []);
});

test('computeDelta (real scanners): perf operations are keyed by name and diffed too', async () => {
    const lines = [
        '[log] PERF loadProfile: 1200ms',
        '[log] PERF loadProfile: 1300ms',
        '[log] PERF renderFeed: 900ms',
    ];
    const reader = fakeReader([lines]);
    const delta = await computeDelta(reader, bound(0, 2), bound(0, 3));
    assert.deepStrictEqual(delta.newSignals.map((s) => s.args), [{ id: 'perf:renderFeed' }]);
});

test('computeDelta (real and injected scanners agree on which lines each side sees', async () => {
    // Guards the fake above from drifting: both scanners must be handed the same slices, so a
    // line-identity scan of the window must contain exactly the window's lines.
    const lines = ['a', 'b', 'c', 'd', 'e'];
    const reader = fakeReader([lines]);
    const seen: string[][] = [];
    const recordingScanner: LineScanner = (input) => {
        seen.push([...input]);
        return { errors: [], warnings: [], perf: [] } as ScannedSignals;
    };
    await computeDelta(reader, bound(0, 3), bound(0, 5), recordingScanner);
    assert.deepStrictEqual(seen[0], ['d', 'e'], 'window slice');
    assert.deepStrictEqual(seen[1], ['a', 'b', 'c'], 'history slice');
    assert.deepStrictEqual(seen[2], ['b', 'c'], 'baseline is the window-length tail of history');
});
