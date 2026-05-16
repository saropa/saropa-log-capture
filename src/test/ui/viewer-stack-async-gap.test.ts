/**
 * Tests for async-gap ("<asynchronous suspension>") stack-group handling.
 *
 * Before the original fix, a gap line failed isStackFrameText() and shattered
 * every Dart async trace into ~15 one-frame groups. The current design folds
 * a gap INTO the active group as an inline broken-chain glyph appended to the
 * previous frame's html — no separate row is created. This keeps traces
 * visually compact while preserving "<asynchronous suspension>" in the DOM
 * for selection/copy (sr-only span inside the glyph; icon comes from CSS
 * ::before so it never lands on the clipboard).
 *
 * An orphan gap with no active group still falls through to normal-line
 * handling — a gap must never start a group on its own.
 */
import * as assert from 'node:assert';
import { loadStackHeaderRepeatSandbox, StackItemVm, StackSandboxVm } from './viewer-stack-header-repeat-sandbox';

// addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier)
function addLine(vm: StackSandboxVm, html: string, ts: number, rawText: string = html): void {
    vm.addToData(html, false, 'debug', ts, false, null, undefined, undefined, 'debug', rawText, undefined);
}

const FRAME_A = 'DriftDebugInterceptor._log (./lib/drift_debug_interceptor.dart:92:5)';
const FRAME_B = '#8  Foo.bar (./lib/foo.dart:276:48)';
const FRAME_C = '#9  Baz.qux (./lib/baz.dart:987:11)';
// The webview always receives HTML-escaped content — the raw "<asynchronous
// suspension>" would otherwise be eaten by stripTags() as a bogus tag. This
// mirrors what the extension's line renderer actually sends.
const GAP = '&lt;asynchronous suspension&gt;';

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

    test('gap is consumed inline — no separate row is added', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000); // header
        addLine(vm, FRAME_B, 1000); // 1 frame
        const before = vm.allLines.length;
        addLine(vm, GAP, 1000);
        assert.strictEqual(vm.allLines.length, before, 'gap must not add a row — it attaches inline to the prior frame');
    });

    test('gap appends the glyph (with hidden raw text) to the prior frame html', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000); // header
        addLine(vm, FRAME_B, 1000); // frame — anchor for the gap glyph
        addLine(vm, GAP, 1000);
        const anchor = vm.allLines[vm.allLines.length - 1];
        const html = anchor.html ?? '';
        assert.ok(html.includes('async-gap-glyph'), 'expected glyph span on the prior frame; got ' + JSON.stringify(html));
        assert.ok(
            html.includes('&lt;asynchronous suspension&gt;'),
            'expected the raw phrase in the sr-only text span for clipboard capture; got ' + JSON.stringify(html),
        );
        assert.ok(
            !html.includes('asynchronous suspension>') || html.includes('&lt;asynchronous suspension&gt;'),
            'raw "<asynchronous suspension>" must only appear HTML-escaped inside .async-gap-text',
        );
    });

    test('first gap (with no frame yet) attaches to the stack-header', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000); // header — no continuation frames yet
        addLine(vm, GAP, 1000);
        const header = vm.allLines.find((i) => i.type === 'stack-header');
        assert.ok(header, 'expected a stack-header');
        assert.ok(
            (header!.html ?? '').includes('async-gap-glyph'),
            'glyph must attach to the header when no continuation frame exists yet',
        );
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

    test("prior frame's rawText gains the verbatim phrase so Alt+Shift+C and search hit it", () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, FRAME_A, 1000); // header
        addLine(vm, FRAME_B, 1000, FRAME_B); // anchor frame — rawText = its plain text
        addLine(vm, GAP, 1000);
        const anchor = vm.allLines[vm.allLines.length - 1] as StackItemVm & { rawText?: string };
        assert.ok(
            (anchor.rawText ?? '').endsWith('<asynchronous suspension>'),
            'prior frame rawText must end with the unescaped phrase; got ' + JSON.stringify(anchor.rawText),
        );
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
 * pure formatting noise — no method, no file, no line, nothing to expand to.
 * tryIngestStackLine() drops it entirely (no row, no icon) since unlike an
 * async gap it has no semantic the user could reveal. An orphan ")" with no
 * active group still falls through to normal-line handling.
 */
suite('trace-tail ")" stack-group handling', () => {
    // Header shape uses the Drift "(./path.dart:line:col)" anchor so the
    // sandbox's minimal isStackFrameText classifier accepts it.
    const HEADER = '_StringStackTrace (#1  Foo.bar (./lib/foo.dart:1:2)';
    const FRAME = '#2  Baz.qux (./lib/baz.dart:3:4)';
    const TAIL = ')';

    test('the ")" closing a Dart trace is dropped entirely — no row added', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000); // becomes the stack-header
        addLine(vm, FRAME, 1000); // frame in group 0
        const before = vm.allLines.length;
        addLine(vm, TAIL, 1000); // _StringStackTrace tail ")"

        assert.strictEqual(vm.allLines.length, before, 'the ")" must not add a row');
        const headers = vm.allLines.filter((i) => i.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'the ")" must not close the group or start a new one');
    });

    test('the ")" trace-tail does not affect the header frame count', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000); // header -> frameCount 1
        addLine(vm, FRAME, 1000); // frame  -> frameCount 2
        addLine(vm, TAIL, 1000); // tail   -> dropped, frameCount unchanged
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

/* Raw Dart stacks emit 6 leading spaces on every continuation frame (e.g.
 * "      #2  Caller (./lib/foo.dart:1:2)"). Combined with the .stack-frames
 * padding-left this pushed continuation frames further right than the header
 * and broke column alignment under expansion. tryIngestStackLine now strips
 * leading whitespace from frame html so the viewer's CSS owns the indent.
 * ANSI dim wrappers on framework frames must survive the trim. */
suite('stack-frame leading-whitespace trim', () => {
    const HEADER = '#0  Foo.bar (./lib/foo.dart:1:2)';

    test('leading spaces are stripped from continuation frame html', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000);
        addLine(vm, '      #1  Baz.qux (./lib/baz.dart:3:4)', 1000);
        const frame = vm.allLines[vm.allLines.length - 1];
        assert.strictEqual(frame.type, 'stack-frame');
        assert.ok(
            !/^\s/.test(frame.html ?? ''),
            'continuation frame html must not start with whitespace; got ' + JSON.stringify(frame.html),
        );
    });

    test('leading ANSI <span> wrapper is preserved when whitespace is stripped', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000);
        addLine(vm, '<span style="opacity:.6">      #1  Baz.qux (./lib/baz.dart:3:4)</span>', 1000);
        const frame = vm.allLines[vm.allLines.length - 1];
        assert.strictEqual(frame.type, 'stack-frame');
        assert.ok(
            /^<span style="opacity:\.6">#1\b/.test(frame.html ?? ''),
            'ANSI dim wrapper must remain at start; got ' + JSON.stringify(frame.html),
        );
    });
});

/* The "<asynchronous suspension>" marker is folded inline onto the prior frame
 * as a broken-chain glyph. The wrapper carries the original phrase in a
 * .async-gap-text span (sr-only via CSS) so clipboard text and search both
 * still hit it; the visible icon is a CSS ::before pseudo-element. role="button"
 * + tabindex makes the glyph keyboard-focusable; click toggles .expanded.
 */
suite('async-gap broken-chain glyph rendering', () => {
    const HEADER = '#0  Foo.bar (./lib/foo.dart:1:2)';

    test('appended glyph carries the tooltip and click affordance', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000);
        addLine(vm, GAP, 1000);
        const anchor = vm.allLines[vm.allLines.length - 1];
        const html = anchor.html ?? '';
        assert.ok(html.includes('class="async-gap-glyph"'), 'expected glyph wrapper class; got ' + JSON.stringify(html));
        assert.ok(html.includes('role="button"'), 'glyph must expose role="button" so click is announced; got ' + JSON.stringify(html));
        assert.ok(html.includes('title="Async suspension'), 'expected explanatory tooltip; got ' + JSON.stringify(html));
    });

    test('the original phrase is HTML-escaped inside .async-gap-text — never raw in html', () => {
        const vm = loadStackHeaderRepeatSandbox();
        addLine(vm, HEADER, 1000);
        addLine(vm, GAP, 1000);
        const anchor = vm.allLines[vm.allLines.length - 1];
        const html = anchor.html ?? '';
        assert.ok(
            html.includes('<span class="async-gap-text">&lt;asynchronous suspension&gt;</span>'),
            'expected sr-only text span carrying the escaped phrase; got ' + JSON.stringify(html),
        );
        // The raw, unescaped angle-bracketed phrase must not appear — that would let the
        // browser parse it as a tag and lose the text from selection/copy entirely.
        assert.ok(
            !/[^&]<asynchronous suspension>/.test(html),
            'raw unescaped phrase must not appear in html; got ' + JSON.stringify(html),
        );
    });
});
