/**
 * Tests for `LineScanOptions`, the per-call cap overrides on the three line scanners
 * (`scanLinesForFingerprints` / `scanLinesForWarningFingerprints` / `scanLinesForPerfFingerprints`).
 *
 * Both caps exist for presentation — a sidecar stores a session's headline signals and a panel
 * shows a short list. A caller that DIFFS two scans needs neither, because a ranked, truncated
 * list is the wrong input to a set difference: a fingerprint dropped from the "before" side is
 * indistinguishable from one that never occurred, so it reports as newly introduced the next time
 * it appears. These pin that the defaults are unchanged for the existing session-end callers and
 * that a diffing caller can actually turn them off.
 *
 * Runs standalone via `node --test out/test/modules/analysis/scanner-line-scan-options.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { scanLinesForFingerprints } from '../../../modules/analysis/error-fingerprint';
import { scanLinesForWarningFingerprints } from '../../../modules/analysis/warning-fingerprint';
import { scanLinesForPerfFingerprints } from '../../../modules/misc/perf-fingerprint';

const noCap = { maxFingerprints: Number.POSITIVE_INFINITY, maxScanLines: Number.POSITIVE_INFINITY };

/**
 * `n` distinct alphabetic tokens. Letters only, because `normalizeLine` folds digit runs into a
 * placeholder — numeric suffixes would collapse dozens of "distinct" lines into one fingerprint
 * and quietly make a rank-cap assertion test nothing.
 */
function distinctTokens(n: number): string[] {
    const letter = (v: number): string => String.fromCharCode(97 + v);
    // Fixed two-letter pairs: distinct for any n up to 676, with no length-based edge cases.
    return Array.from({ length: n }, (_, i) => `${letter(Math.floor(i / 26) % 26)}${letter(i % 26)}`);
}

/** `n` error lines that each normalize to their own fingerprint. */
function distinctErrors(n: number): string[] {
    return distinctTokens(n).map((t) => `ERROR: subsystem ${t} refused to start`);
}

/** `n` warning lines that each normalize to their own fingerprint. */
function distinctWarnings(n: number): string[] {
    return distinctTokens(n).map((t) => `WARNING: deprecated api ${t} in use`);
}

test('error scan: defaults still cap the returned fingerprint list at 30', () => {
    const result = scanLinesForFingerprints(distinctErrors(45));
    assert.strictEqual(result.length, 30, 'session-end callers must keep their presentation cap');
});

test('error scan: maxFingerprints override returns the complete set', () => {
    const lines = distinctErrors(45);
    const result = scanLinesForFingerprints(lines, noCap);
    assert.strictEqual(result.length, 45);
});

test('error scan: maxScanLines override reads past the default line cap', () => {
    // A single error far past the default 50,000-line cap: invisible by default, found when the
    // cap is lifted. This is the "before" side of a comparison silently losing evidence.
    const lines = new Array(51_000).fill('ordinary chatter');
    lines.push('ERROR: very late failure');

    assert.deepStrictEqual(scanLinesForFingerprints(lines), [], 'default cap stops short of the error');
    const lifted = scanLinesForFingerprints(lines, noCap);
    assert.strictEqual(lifted.length, 1);
    assert.ok(lifted[0].n.includes('very late failure'));
});

test('error scan: an explicit maxScanLines below the default still truncates', () => {
    const lines = ['ordinary chatter', 'ERROR: second line failure'];
    assert.deepStrictEqual(scanLinesForFingerprints(lines, { maxScanLines: 1 }), []);
});

test('warning scan: defaults cap at 30, override returns the full set', () => {
    const lines = distinctWarnings(40);
    assert.strictEqual(scanLinesForWarningFingerprints(lines).length, 30);
    assert.strictEqual(scanLinesForWarningFingerprints(lines, noCap).length, 40);
});

test('perf scan: defaults cap the returned list at 30', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `[log] PERF operation${i}: ${100 + i}ms`);
    assert.strictEqual(scanLinesForPerfFingerprints(lines).length, 30);
    assert.strictEqual(scanLinesForPerfFingerprints(lines, noCap).length, 40);
});

test('perf scan: its own line cap is 5,000, a tenth of the shared one', () => {
    // The tightest of the three caps and the easiest to trip: 5,000 physical lines is a short
    // session, not a long one, so an unlifted perf scan of a history window sees almost none of it.
    const lines = new Array(5_200).fill('ordinary chatter');
    lines.push('[log] PERF lateOperation: 900ms');

    assert.deepStrictEqual(scanLinesForPerfFingerprints(lines), [], 'default perf cap stops at 5,000 lines');
    const lifted = scanLinesForPerfFingerprints(lines, noCap);
    assert.deepStrictEqual(lifted.map((p) => p.name), ['lateOperation']);
});

test('all three scanners: an empty slice scans to an empty set, not a throw', () => {
    assert.deepStrictEqual(scanLinesForFingerprints([], noCap), []);
    assert.deepStrictEqual(scanLinesForWarningFingerprints([], noCap), []);
    assert.deepStrictEqual(scanLinesForPerfFingerprints([], noCap), []);
});
