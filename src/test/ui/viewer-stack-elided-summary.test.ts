/**
 * Tests for Flutter frame-elision summary ("...  Normal element mounting (N
 * frames)") stack-group handling.
 *
 * Flutter substitutes a single "..." summary row for a long run of collapsed
 * framework frames. Before the fix that row failed isStackFrameText() and hit
 * the group-close path in addToData(), so a single logical trace (e.g. #0-#262)
 * shattered into one collapsed group per elision — the reported bug showed five
 * separate ▸ toggles where there should be one. The fix folds the summary INTO
 * the open group as a framework frame row (fw forced true) so the whole trace
 * collapses as a single unit and preview-collapse hides the summary with the
 * rest of the framework noise.
 *
 * An orphan summary with no active group still falls through to normal-line
 * handling — a summary must never start a group on its own.
 */
import * as assert from 'node:assert';
import { loadStackHeaderRepeatSandbox, StackItemVm, StackSandboxVm } from './viewer-stack-header-repeat-sandbox';

// addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier)
function addLine(vm: StackSandboxVm, html: string, ts: number, rawText: string = html): void {
    vm.addToData(html, false, 'debug', ts, false, null, undefined, undefined, 'debug', rawText, undefined);
}

// Frames use the Drift "(./path.dart:line:col)" anchor the sandbox's minimal
// isStackFrameText classifier accepts. Real Flutter frames carry "package:" paths,
// but the grouping logic under test is identical regardless of the frame shape.
const FRAME_0 = '#0  debugChildrenHaveDuplicateKeys (./lib/debug.dart:218:7)';
const FRAME_1 = '#1  MultiChildRenderObjectWidget.createElement (./lib/framework.dart:2051:52)';
const FRAME_35 = '#35  Element.inflateWidget (./lib/framework.dart:4587:20)';
const SUMMARY_32 = '...     Normal element mounting (32 frames)';
const SUMMARY_9 = '...     Normal element mounting (9 frames)';

suite('Flutter elided-frames-summary stack-group continuation', () => {
    test('a summary between frames keeps the trace as ONE group', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_0, 1000); // becomes the stack-header
        addLine(vm, FRAME_1, 1000); // frame in group 0
        addLine(vm, SUMMARY_32, 1000); // elision summary — must NOT close the group
        addLine(vm, FRAME_35, 1000); // frame still in group 0

        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'expected exactly one stack-header — summary must not shatter the group');
        const gids = new Set(
            vm.allLines.filter((i) => i.type === 'stack-frame' || i.type === 'stack-header').map((i) => i.groupId),
        );
        assert.strictEqual(gids.size, 1, 'every frame and the summary must share one groupId');
    });

    test('multiple summaries (the reported #0-#262 trace) collapse into one group, not five', () => {
        const vm = loadStackHeaderRepeatSandbox();
        // Mirrors the screenshot: frames interleaved with four elision summaries.
        addLine(vm, FRAME_0, 1000);
        addLine(vm, FRAME_1, 1000);
        addLine(vm, SUMMARY_32, 1000);
        addLine(vm, FRAME_35, 1000);
        addLine(vm, SUMMARY_9, 1000);
        addLine(vm, '#46  SingleChildWidgetElementMixin.mount (./lib/nested.dart:222:11)', 1000);
        addLine(vm, '...     Normal element mounting (176 frames)', 1000);
        addLine(vm, '#222  Element.inflateWidget (./lib/framework.dart:4587:20)', 1000);

        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'four elision summaries must still yield exactly one stack-header');
    });

    test('summary is a visible stack-frame row (unlike async-gap, which folds inline)', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_0, 1000); // header
        addLine(vm, FRAME_1, 1000); // 1 frame
        const before = vm.allLines.length;
        addLine(vm, SUMMARY_32, 1000);
        assert.strictEqual(vm.allLines.length, before + 1, 'summary must add its own row, not fold into the prior frame');
        const row = vm.allLines[vm.allLines.length - 1];
        assert.strictEqual(row.type, 'stack-frame', 'summary row must be a stack-frame in the group');
        assert.ok(
            (row.html ?? '').includes('Normal element mounting (32 frames)'),
            'summary text must survive for selection/copy; got ' + JSON.stringify(row.html),
        );
    });

    test('summary row is forced framework (fw=true) so preview-collapse hides it', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_0, 1000); // header
        addLine(vm, SUMMARY_32, 1000);
        const row = vm.allLines[vm.allLines.length - 1] as StackItemVm & { fw?: boolean };
        assert.strictEqual(row.fw, true, 'elision summary must be flagged framework so it is not a "first app frame"');
    });

    test('an orphan summary with no active group stays a normal line', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, SUMMARY_32, 1000); // no active group header
        assert.strictEqual(vm.allLines.length, 1, 'expected the orphan summary to produce one row');
        assert.strictEqual(
            vm.allLines[0].type,
            'line',
            'orphan summary must fall through to normal-line handling, not start a group',
        );
    });

    test('prose ellipsis without a "(N frames)" suffix does NOT get swallowed', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_0, 1000); // header — group open
        addLine(vm, '... and then the build settled down', 1000); // not a summary
        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        // The prose line closes the group and renders as a normal line; the
        // "(N frames)" suffix requirement is what keeps it out.
        const last = vm.allLines[vm.allLines.length - 1];
        assert.strictEqual(last.type, 'line', 'prose ellipsis must remain a normal line');
        assert.strictEqual(headers.length, 1, 'prose line must not start a second group');
    });
});
