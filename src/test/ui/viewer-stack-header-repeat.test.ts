/**
 * Regression tests for stack-header repeat collapse (bug_003).
 *
 * Exercises the new-group branch in `addToData`. In the real Drift pattern the
 * sequence is: SQL line → stack frame → SQL line → stack frame, where each SQL
 * line nulls `activeGroupHeader` via the non-frame path and SQL's
 * `handleRepeatCollapse` leaves the stack-header tracker untouched. To avoid
 * dragging in the full SQL fingerprint pipeline, these tests null
 * `activeGroupHeader` directly between frames — the effect on
 * `tryCollapseRepeatStackHeader` is identical.
 */
import * as assert from 'node:assert';
import { loadStackHeaderRepeatSandbox, type StackItemVm, type StackSandboxVm } from './viewer-stack-header-repeat-sandbox';

const FRAME = '⠀ » DriftDebugInterceptor._log (./lib/database/drift/drift_debug_interceptor.dart:92:5)';
const DIFFERENT_FRAME = '⠀ » SomeOther._fn (./lib/other/other.dart:10:3)';

function addFrame(s: StackSandboxVm, html: string, ts: number): void {
    /* Positional signature of addToData: html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier */
    s.addToData(html, false, 'stdout', ts, false, null, undefined, undefined, 'debug');
}

function addPlainLine(s: StackSandboxVm, html: string, ts: number): void {
    s.addToData(html, false, 'stdout', ts, false, null, undefined, undefined, 'debug');
}

function addIsolatedFrame(s: StackSandboxVm, html: string, ts: number): void {
    /* Simulates the Drift pattern's "non-frame SQL line between frames nulled
       activeGroupHeader but did not reset the stack-header tracker" boundary. */
    s.activeGroupHeader = null;
    addFrame(s, html, ts);
}

suite('viewer stack-header repeat collapse (bug_003)', () => {
    test('three consecutive matching single-frame stack-headers collapse to one chip', () => {
        const s = loadStackHeaderRepeatSandbox();
        const t0 = 1_000_000;
        addIsolatedFrame(s, FRAME, t0);
        addIsolatedFrame(s, FRAME, t0 + 100);
        addIsolatedFrame(s, FRAME, t0 + 200);

        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        const chips = s.allLines.filter((l: StackItemVm) => l.type === 'repeat-notification' && l.stackHdrRepeat);
        assert.strictEqual(headers.length, 1, 'only the anchor stack-header should remain in allLines');
        assert.strictEqual(chips.length, 1, 'exactly one stackHdrRepeat notification should be pushed');
        assert.ok(chips[0].html?.includes('3 × stack repeated:'), 'chip text should read "3 × stack repeated:"');
        assert.strictEqual(headers[0].repeatHidden, true, 'anchor must be marked repeatHidden');
        assert.strictEqual(headers[0].height, 0, 'anchor must be zero-height while streak is active');
        assert.strictEqual(headers[0].collapsed, true, 'anchor collapsed=true so its frames hide via calcItemHeight');
    });

    test('plain-line content between isolated matching headers breaks the streak', () => {
        const s = loadStackHeaderRepeatSandbox();
        const t0 = 1_000_000;
        addIsolatedFrame(s, FRAME, t0);
        /* A real non-frame line arriving here hits the shouldShowNormalLine branch and calls
           resetStackHdrRepeatTracker — that reset is the streak break, not the null of
           activeGroupHeader (which happens for any non-frame content). */
        addPlainLine(s, 'some unrelated log output', t0 + 50);
        addIsolatedFrame(s, FRAME, t0 + 100);

        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        const chips = s.allLines.filter((l: StackItemVm) => l.type === 'repeat-notification' && l.stackHdrRepeat);
        assert.strictEqual(headers.length, 2, 'both headers must remain as separate stack groups');
        assert.strictEqual(chips.length, 0, 'no repeat chip should be produced when content breaks the streak');
        assert.strictEqual(headers[0].repeatHidden, undefined, 'first anchor must stay visible — streak was broken');
    });

    test('isolated headers with different content do not collapse', () => {
        const s = loadStackHeaderRepeatSandbox();
        const t0 = 1_000_000;
        addIsolatedFrame(s, FRAME, t0);
        addIsolatedFrame(s, DIFFERENT_FRAME, t0 + 100);

        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        const chips = s.allLines.filter((l: StackItemVm) => l.type === 'repeat-notification' && l.stackHdrRepeat);
        assert.strictEqual(headers.length, 2, 'differing plain-text hashes must not merge');
        assert.strictEqual(chips.length, 0, 'no chip on content mismatch');
    });

    test('isolated matching headers outside repeatWindowMs (>3s apart) do not collapse', () => {
        const s = loadStackHeaderRepeatSandbox();
        const t0 = 1_000_000;
        addIsolatedFrame(s, FRAME, t0);
        /* repeatWindowMs in viewer-data-helpers-core.ts is 3000. Use 3100 to cross it. */
        addIsolatedFrame(s, FRAME, t0 + 3100);

        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        const chips = s.allLines.filter((l: StackItemVm) => l.type === 'repeat-notification' && l.stackHdrRepeat);
        assert.strictEqual(headers.length, 2, 'second header beyond window must start fresh');
        assert.strictEqual(chips.length, 0, 'no chip when the window is exceeded');
    });

    test('marker cleanup restores a trailing-chip anchor and breaks the streak', () => {
        const s = loadStackHeaderRepeatSandbox();
        const t0 = 1_000_000;
        addIsolatedFrame(s, FRAME, t0);
        addIsolatedFrame(s, FRAME, t0 + 100);
        addIsolatedFrame(s, FRAME, t0 + 200);
        /* Marker arrives with trailing stack-header chip: cleanupTrailingRepeats must
           un-hide the anchor (repeatHidden=false, height>0) and zero the chip. */
        s.addToData('--- session marker ---', true, 'marker', t0 + 300, false, null, undefined, undefined, 'debug');
        /* A post-marker repeat of the same content must NOT fold into the pre-marker streak. */
        addIsolatedFrame(s, FRAME, t0 + 400);

        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        assert.strictEqual(headers.length, 2, 'pre- and post-marker headers are independent');
        assert.strictEqual(headers[0].repeatHidden, false, 'trailing-chip cleanup must un-hide the pre-marker anchor');
        assert.ok(headers[0].height > 0, 'restored anchor should have non-zero height');
        assert.strictEqual(headers[1].repeatHidden, undefined, 'post-marker header is a fresh anchor');
    });

    test('tracker resets after plain-line break so new streaks start at count 2', () => {
        const s = loadStackHeaderRepeatSandbox();
        const t0 = 1_000_000;
        addIsolatedFrame(s, FRAME, t0);
        addIsolatedFrame(s, FRAME, t0 + 100);
        /* Plain line — resets the stack-header tracker via the normal-line push branch. */
        addPlainLine(s, 'break', t0 + 150);
        addIsolatedFrame(s, FRAME, t0 + 200);
        addIsolatedFrame(s, FRAME, t0 + 300);

        const chips = s.allLines.filter((l: StackItemVm) => l.type === 'repeat-notification' && l.stackHdrRepeat);
        /* Pre-break had 2 occurrences → 1 chip with count=2. Post-break had 2 more → 1 more chip with count=2. */
        assert.strictEqual(chips.length, 2, 'two independent streaks produce two chips');
        assert.ok(chips[0].html?.includes('2 × stack repeated:'), 'first chip starts at 2');
        assert.ok(chips[1].html?.includes('2 × stack repeated:'), 'second chip starts at 2, not continuing from 3');
    });
});
