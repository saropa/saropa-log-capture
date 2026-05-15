/**
 * Tests for async-gap ("<asynchronous suspension>") stack-group continuation —
 * Item A of bugs/PLAN_VIEWER_STACK_NOISE_FILTER_LAYOUT.md.
 *
 * Before the fix, an async-gap line failed isStackFrameText(), hit the
 * group-close path in addToData(), and shattered every Dart async trace into
 * ~15 one-frame groups. tryIngestStackLine() now folds a gap into the OPEN
 * group as an fw=true continuation frame; an orphan gap (no active group)
 * stays a normal line.
 */
import * as assert from 'node:assert';
import { loadStackHeaderRepeatSandbox, StackItemVm, StackSandboxVm } from './viewer-stack-header-repeat-sandbox';

// addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier)
function addLine(vm: StackSandboxVm, html: string, ts: number): void {
    vm.addToData(html, false, 'debug', ts, false, null, undefined, undefined, 'debug', html, undefined);
}

const FRAME_A = 'DriftDebugInterceptor._log (./lib/drift_debug_interceptor.dart:92:5)';
const FRAME_B = '#8  Foo.bar (./lib/foo.dart:276:48)';
const FRAME_C = '#9  Baz.qux (./lib/baz.dart:987:11)';
// The webview always receives HTML-escaped content — the raw "<asynchronous
// suspension>" would otherwise be eaten by stripTags() as a bogus tag. This
// mirrors what the extension's line renderer actually sends.
const GAP = '&lt;asynchronous suspension&gt;';

type GapItem = StackItemVm & { fw?: boolean; isAsyncGap?: boolean };

suite('async-gap stack-group continuation', () => {
    test('a gap between frames keeps the trace as ONE group', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000); // becomes the stack-header
        addLine(vm, FRAME_B, 1000); // frame in group 0
        addLine(vm, GAP, 1000); // async gap — must NOT close the group
        addLine(vm, FRAME_C, 1000); // frame still in group 0

        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'expected exactly one stack-header — gap must not shatter the group');
        const gids = new Set(
            vm.allLines.filter((i) => i.type === 'stack-frame' || i.type === 'stack-header').map((i) => i.groupId),
        );
        assert.strictEqual(gids.size, 1, 'every frame and the gap must share one groupId');
    });

    test('gap is ingested as an fw=true stack-frame flagged isAsyncGap', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000);
        addLine(vm, GAP, 1000);
        const gap = vm.allLines[vm.allLines.length - 1] as GapItem;
        assert.strictEqual(gap.type, 'stack-frame', 'gap must be ingested as a stack-frame');
        assert.strictEqual(gap.isAsyncGap, true, 'gap must carry the isAsyncGap flag');
        assert.strictEqual(gap.fw, true, 'gap must be fw=true so it hides in collapsed/preview state');
    });

    test('gaps are excluded from the header frame count', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000); // header -> frameCount 1
        addLine(vm, FRAME_B, 1000); // frame  -> frameCount 2
        addLine(vm, GAP, 1000); // gap    -> frameCount unchanged
        addLine(vm, FRAME_C, 1000); // frame  -> frameCount 3
        const header = vm.allLines.find((i) => i.type === 'stack-header');
        assert.ok(header, 'expected a stack-header');
        assert.strictEqual(header!.frameCount, 3, 'frameCount must count header + real frames only, not gaps');
    });

    test('an orphan gap with no active group stays a normal line', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, GAP, 1000); // no active group header
        assert.strictEqual(vm.allLines.length, 1, 'expected the orphan gap to produce one row');
        assert.strictEqual(
            vm.allLines[0].type,
            'line',
            'orphan gap must fall through to normal-line handling, not start a group',
        );
    });
});

/*
 * The bare ")" that closes Dart's "_StringStackTrace (#0 … )" object dump is
 * payload-free framework noise — the same shape problem as the async gap above.
 * Before the fix it failed isStackFrameText(), hit the group-close path in
 * addToData(), and rendered as a junk ")" row after every trace.
 * tryIngestStackLine() now folds it into the OPEN group as an fw=true frame;
 * an orphan ")" (no active group) stays a normal line.
 */
suite('trace-tail ")" stack-group continuation', () => {
    // Header shape uses the Drift "(./path.dart:line:col)" anchor so the
    // sandbox's minimal isStackFrameText classifier accepts it.
    const HEADER = '_StringStackTrace (#1  Foo.bar (./lib/foo.dart:1:2)';
    const FRAME = '#2  Baz.qux (./lib/baz.dart:3:4)';
    const TAIL = ')';

    test('the ")" closing a Dart trace folds into the group, not a junk line', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000); // becomes the stack-header
        addLine(vm, FRAME, 1000); // frame in group 0
        addLine(vm, TAIL, 1000); // _StringStackTrace tail ")" — must fold in

        const tail = vm.allLines[vm.allLines.length - 1] as GapItem;
        assert.strictEqual(tail.type, 'stack-frame', 'the ")" must be ingested into the group, not left as a normal line');
        assert.strictEqual(tail.fw, true, 'the ")" must be fw=true so it hides in collapsed/preview state');
        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'the ")" must not close the group or start a new one');
    });

    test('the ")" trace-tail is excluded from the header frame count', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000); // header -> frameCount 1
        addLine(vm, FRAME, 1000); // frame  -> frameCount 2
        addLine(vm, TAIL, 1000); // tail   -> frameCount unchanged
        const header = vm.allLines.find((i) => i.type === 'stack-header');
        assert.ok(header, 'expected a stack-header');
        assert.strictEqual(header!.frameCount, 2, 'frameCount must count header + real frames only, not the ")" tail');
    });

    test('an orphan ")" with no active group stays a normal line', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, TAIL, 1000); // no active group header
        assert.strictEqual(vm.allLines.length, 1, 'expected the orphan ")" to produce one row');
        assert.strictEqual(
            vm.allLines[0].type,
            'line',
            'orphan ")" must fall through to normal-line handling, not start a group',
        );
    });
});
