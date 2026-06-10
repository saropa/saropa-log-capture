import * as assert from 'node:assert';
import { loadStackHeaderRepeatSandbox, type StackItemVm, type StackSandboxVm } from './viewer-stack-header-repeat-sandbox';
import { getCounterAffordanceScript } from '../../ui/viewer/viewer-data-divider';
import { getViewerClickHandlerScript } from '../../ui/viewer/viewer-script-click-handlers';

/**
 * "The message IS the toggle" — owner promotion (user report 2026-06-09: a log
 * line and its stack were rendering as TWO collapsible rows; the message line is
 * now the single toggle and the stack folds under it, one level, no sub-row).
 *
 * The sandbox's isStackFrameText matches parenthesized `(./path.dart:line:col)`.
 */
const FRAME_A = 'A.one (./lib/a.dart:10:1)';
const FRAME_B = 'B.two (./lib/b.dart:20:2)';

function feed(s: StackSandboxVm, html: string, ts: number): void {
    s.addToData(html, false, 'stdout', ts, false, null, undefined, undefined, 'debug', html, undefined);
}

suite('stack owner promotion — the message IS the toggle', () => {
    test('a log line preceding a trace becomes the stack owner; frames fold under it', () => {
        const s = loadStackHeaderRepeatSandbox();
        feed(s, 'My log message', 1000);
        feed(s, FRAME_A, 1000);
        feed(s, FRAME_B, 1000);

        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        assert.strictEqual(headers.length, 0, 'no separate stack-header row — the message owns the trace');

        const owner = s.allLines.find((l) => (l as { _stackOwner?: boolean })._stackOwner) as
            (StackItemVm & { _stackOwner?: boolean; groupId?: number }) | undefined;
        assert.ok(owner, 'the preceding log line was promoted to the stack owner');
        assert.strictEqual(owner!.type, 'line', 'the owner stays a normal line type');
        assert.strictEqual(owner!.frameCount, 3, 'frameCount = owner + 2 frames (tooltip shows 2)');

        const frames = s.allLines.filter((l: StackItemVm) => l.type === 'stack-frame');
        assert.strictEqual(frames.length, 2, 'both frames are children of the owner');
        assert.ok(frames.every((f) => f.groupId === owner!.groupId), 'frames share the owner group id');
    });

    test('a trace with no eligible preceding line still forms its own stack-header', () => {
        const s = loadStackHeaderRepeatSandbox();
        s.activeGroupHeader = null;
        feed(s, FRAME_A, 1000); // first item — no preceding line to own it
        feed(s, FRAME_B, 1000);
        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'fallback: first frame becomes the stack-header');
        const owners = s.allLines.filter((l) => (l as { _stackOwner?: boolean })._stackOwner);
        assert.strictEqual(owners.length, 0, 'no owner promotion when there is no preceding log line');
    });

    test('a database/SQL line is NOT promoted (Drift repeat-collapse stays intact)', () => {
        const s = loadStackHeaderRepeatSandbox();
        feed(s, 'Drift: Sent SELECT * FROM contacts', 1000);
        // Force the database source tag the real parseSourceTag would assign.
        const last = s.allLines[s.allLines.length - 1] as StackItemVm & { sourceTag?: string };
        last.sourceTag = 'database';
        feed(s, FRAME_A, 1000);
        feed(s, FRAME_B, 1000);
        const owners = s.allLines.filter((l) => (l as { _stackOwner?: boolean })._stackOwner);
        assert.strictEqual(owners.length, 0, 'database line must not become a stack owner');
        const headers = s.allLines.filter((l: StackItemVm) => l.type === 'stack-header');
        assert.strictEqual(headers.length, 1, 'the trace forms its own stack-header (fallback path) for database lines');
    });

    test('getCounterAffordance emits the stack chevron for an owner line', () => {
        const aff = getCounterAffordanceScript();
        assert.ok(
            aff.includes("(item.type === 'stack-header' || item._stackOwner) && item.frameCount > 1"),
            'owner lines must reach the stack-chevron branch',
        );
    });

    test('the click handler toggles an owner line on a whole-row click (selection-guarded)', () => {
        const click = getViewerClickHandlerScript();
        assert.ok(click.includes('_oit._stackOwner'), 'click handler resolves the owner via data-idx');
        assert.ok(click.includes('toggleStackGroup(_oit.groupId)'), 'whole-row click toggles the owner group');
        assert.ok(click.includes('isCollapsed'), 'guarded on a collapsed selection so text-select is not hijacked');
    });
});
