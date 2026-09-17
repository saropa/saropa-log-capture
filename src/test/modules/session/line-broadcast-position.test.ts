/**
 * Tests for the physical line number `session-manager-events.ts` puts on a broadcast `LineData`.
 *
 * `LineData.physicalLineCount` is what the error snackbar's "Open Log" jump and screenshot
 * capture's flow-map position both key off, so the number has to name the line the reader wants to
 * land on. Two things decide it: the broadcast has to ride the write-time callback at all (reading
 * the session's counters on the next statement reports where the file stood before the append
 * queue drained), and it has to pick the right end of the block once it gets there.
 *
 * The session here is a stand-in that writes synchronously — the real queue's timing is covered
 * against a real `LogSession` in `log-session-line-position.test.ts`. What is asserted here is the
 * choice the broadcast site makes with the position it is handed.
 *
 * Runs standalone via `node --test out/test/modules/session/line-broadcast-position.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { processApiWriteLine, type OutputEventTarget, type WriteLineDeps } from '../../../modules/session/session-manager-events';
import { FloodGuard } from '../../../modules/capture/flood-guard';
import { SpamSuppressor } from '../../../modules/capture/spam-suppressor';
import type { LineData } from '../../../modules/session/session-event-bus';
import type { LogSession } from '../../../modules/capture/log-session';
import type { WritePosition } from '../../../modules/capture/log-session-helpers';

/**
 * Session stand-in that reports a caller-supplied position for every line, so a test can state
 * exactly what the queue would have said and assert what the broadcast made of it.
 */
function sessionReporting(position: WritePosition) {
    const session = {
        lineCount: 0,
        physicalLineCount: 0,
        state: 'recording' as const,
        fileUri: { fsPath: '/mock/session.log' },
        appendLine(
            _text: string,
            _category: string,
            _timestamp: Date,
            options?: { onWritten?: (p: WritePosition) => void },
        ) {
            session.lineCount++;
            options?.onWritten?.(position);
        },
    };
    return session as unknown as LogSession;
}

/** A session that never writes — nothing should be announced for it. */
function sessionThatNeverWrites() {
    return {
        lineCount: 0,
        physicalLineCount: 0,
        state: 'recording' as const,
        fileUri: { fsPath: '/mock/session.log' },
        appendLine() { /* enqueued and then dropped — the callback never fires */ },
    } as unknown as LogSession;
}

function makeDeps(): WriteLineDeps {
    return {
        config: { enabled: true },
        exclusionRules: [],
        floodGuard: new FloodGuard(),
        spamSuppressor: new SpamSuppressor(),
    };
}

function makeTarget(): OutputEventTarget & { broadcasts: Omit<LineData, 'watchHits'>[] } {
    const broadcasts: Omit<LineData, 'watchHits'>[] = [];
    return {
        broadcasts,
        counters: { categoryCounts: {}, floodSuppressedTotal: 0 },
        broadcastLine: (data) => { broadcasts.push(data); },
    };
}

test('broadcast carries the position reported by the write, not a counter read afterwards', () => {
    const target = makeTarget();
    const session = sessionReporting({ partNumber: 2, before: 417, after: 418 });
    processApiWriteLine(makeDeps(), target, { session, text: 'hello', category: 'console', timestamp: new Date() });

    assert.strictEqual(target.broadcasts.length, 1);
    assert.strictEqual(target.broadcasts[0].physicalLineCount, 418);
});

test('broadcast anchors a multi-line block to its first line, not its last', () => {
    // A stack trace arrives as one DAP output event, and this path does not split embedded
    // newlines — so `after` names the last frame. "Open Log" wants the line the error starts on.
    const target = makeTarget();
    const session = sessionReporting({ partNumber: 0, before: 30, after: 34 });
    processApiWriteLine(makeDeps(), target, { session, text: 'boom', category: 'stderr', timestamp: new Date() });

    assert.strictEqual(target.broadcasts[0].physicalLineCount, 31);
});

test('a line that never reaches the file is never broadcast', () => {
    const target = makeTarget();
    processApiWriteLine(makeDeps(), target, {
        session: sessionThatNeverWrites(), text: 'dropped', category: 'console', timestamp: new Date(),
    });

    assert.deepStrictEqual(target.broadcasts, [], 'the viewer must not show a line the log lacks');
});
