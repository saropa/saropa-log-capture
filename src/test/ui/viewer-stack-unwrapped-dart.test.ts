/**
 * Regression tests for bug_001 — Dart stacks now arrive without the
 * `_StringStackTrace (#0  …  )` wrapper.
 *
 * Upstream context: the contacts project's central `debug()` helper stopped
 * passing `stackTrace:` to `dart:developer.log()` and now appends the stack as
 * plain text on the next line of the message body. This kills the ugly
 * `_StringStackTrace` envelope that VS Code's debug console rendered, but it
 * also means the body-text stack ingestion path (`isStackFrameText()` matching
 * `#N` etc.) becomes the SOLE collapse path for Dart stacks from this source —
 * no leading `_StringStackTrace (` line, no trailing `)` line.
 *
 * The wrapper-compensation code (`isTraceTail` in viewer-data-add-stack-ingest.ts)
 * is NOT removed — other Dart projects and call sites that still pass
 * `stackTrace:` to `log()` keep emitting the wrapped form, and the existing
 * `viewer-stack-async-gap.test.ts` "trace-tail" suite covers that path. These
 * tests cover the new unwrapped path alongside it.
 */
import * as assert from 'node:assert';
import { loadStackHeaderRepeatSandbox, StackSandboxVm } from './viewer-stack-header-repeat-sandbox';

// addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier)
function addLine(vm: StackSandboxVm, html: string, ts: number): void {
    vm.addToData(html, false, 'debug', ts, false, null, undefined, undefined, 'debug', html, undefined);
}

/* Unwrapped Dart frames as the contacts debug helper now emits them: bare
   "#N  Caller (./lib/path.dart:line:col)" lines, no _StringStackTrace envelope.
   The sandbox's minimal isStackFrameText classifier accepts any line containing
   "(./...:dart:N:N)" — which all three frames do — so the production "^#\d+\s"
   rule isn't strictly needed for the sandbox to recognize them. The frames
   double as a guard that nothing in the ingestion path requires the wrapper. */
const FRAME_0 = '#0      LocationService.fetch (./lib/services/location.dart:42:9)';
const FRAME_1 = '#1      _ContactsHomePageState.refresh (./lib/screens/home.dart:128:5)';
const FRAME_2 = '#2      Foo.bar (./lib/foo.dart:7:11)';
const MESSAGE = 'PermissionDeniedException: location permission denied';
const GAP = '&lt;asynchronous suspension&gt;';

suite('unwrapped Dart stack ingestion (bug_001)', () => {
    test('three unwrapped #N frames collapse into ONE group under the message owner', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, MESSAGE, 1000); // normal line — promoted to the trace's stack OWNER
        addLine(vm, FRAME_0, 1000); // child frame of the owner
        addLine(vm, FRAME_1, 1000); // child frame
        addLine(vm, FRAME_2, 1000); // child frame

        /* "The message IS the toggle": the owning log line carries the group, so
           there is NO separate stack-header row; all three frames fold under it. */
        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 0, 'message owns the trace — no separate stack-header row');

        const owner = vm.allLines.find((i) => (i as { _stackOwner?: boolean })._stackOwner);
        assert.ok(owner, 'the preceding message line was promoted to the stack owner');
        assert.strictEqual(owner!.frameCount, 4, 'frameCount = owner + 3 real frames (tooltip shows 3)');

        const gids = new Set(
            vm.allLines.filter((i) => i.type === 'stack-frame').map((i) => i.groupId),
        );
        assert.strictEqual(gids.size, 1, 'every frame must share one groupId — no shattering on missing wrapper');
        assert.strictEqual([...gids][0], owner!.groupId, 'frames belong to the owner group');
    });

    test('no orphan ")" tail row appears after the trace', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, MESSAGE, 1000);
        addLine(vm, FRAME_0, 1000);
        addLine(vm, FRAME_1, 1000);
        addLine(vm, FRAME_2, 1000);

        /* Sanity-check the regression directly: the new shape never includes the
           bare ")" line, so allLines must contain no stack-frame whose stripped
           html is ")". (The existing trace-tail suite covers the wrapped path.) */
        const tailRows = vm.allLines.filter((i) => {
            const html = (i.html || '').replace(/<[^>]*>/g, '').trim();
            return html === ')';
        });
        assert.strictEqual(tailRows.length, 0, 'unwrapped trace must not produce a ")" tail row');
    });

    test('async gap between unwrapped frames keeps the trace as ONE group', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, MESSAGE, 1000);
        addLine(vm, FRAME_0, 1000); // header
        addLine(vm, FRAME_1, 1000); // frame — anchor for gap glyph
        const before = vm.allLines.length;
        addLine(vm, GAP, 1000); // async gap — must NOT close the group, no row added
        addLine(vm, FRAME_2, 1000); // frame still in same group

        /* Owner-mode: the message owns the trace, so no separate stack-header row;
           the gap must still not shatter the single owner group. */
        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 0, 'message owns the trace — no separate stack-header row');
        const owner = vm.allLines.find((i) => (i as { _stackOwner?: boolean })._stackOwner);
        assert.ok(owner, 'the message line was promoted to the stack owner');

        // The gap is folded inline — no extra row. Before-after delta should be 1 (only FRAME_2).
        assert.strictEqual(
            vm.allLines.length - before,
            1,
            'gap must not create a row; only the trailing frame should be added',
        );

        // Find the anchor (FRAME_1) — it now carries the glyph in its html.
        const anchor = vm.allLines.find((i) => (i.html ?? '').includes('home.dart:128'));
        assert.ok(anchor, 'expected to find the anchor frame');
        assert.ok(
            (anchor!.html ?? '').includes('async-gap-glyph'),
            'glyph must be appended to the prior frame; got ' + JSON.stringify(anchor!.html),
        );

        assert.strictEqual(
            owner!.frameCount,
            4,
            'frameCount = owner + 3 real frames; the gap is excluded',
        );
    });
});
