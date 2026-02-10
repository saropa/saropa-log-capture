import * as assert from 'assert';
import {
    createThreadDumpState, processLineForThreadDump, flushThreadDump,
} from '../ui/viewer-thread-grouping';
import type { PendingLine } from '../ui/viewer-file-loader';

function makeLine(text: string, isMarker = false): PendingLine {
    return { text, isMarker, lineCount: 1, category: 'stdout', timestamp: 0 };
}

suite('Thread Dump Grouping', () => {

    test('should pass non-thread lines through unchanged', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('hello world'), 'hello world', pending);
        assert.strictEqual(pending.length, 1);
        assert.strictEqual(pending[0].text, 'hello world');
    });

    test('should group multi-thread dump with summary', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        processLineForThreadDump(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        processLineForThreadDump(state, makeLine('t2'), '"Signal Catcher" tid=3 Waiting', pending);
        processLineForThreadDump(state, makeLine('f2'), '    at java.lang.Object.wait(Native Method)', pending);
        // Non-thread line triggers flush
        processLineForThreadDump(state, makeLine('normal line'), 'normal line', pending);
        // Summary marker + 2 headers + 2 frames + the normal line = 6
        assert.strictEqual(pending.length, 6);
        assert.ok(pending[0].isMarker, 'first line should be summary marker');
        assert.ok(pending[0].text.includes('2 threads'), 'summary should mention thread count');
        assert.strictEqual(pending[5].text, 'normal line');
    });

    test('should emit single thread without summary', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        processLineForThreadDump(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        processLineForThreadDump(state, makeLine('end'), 'end of thread', pending);
        // 1 header + 1 frame + 1 normal line = 3 (no summary for single thread)
        assert.strictEqual(pending.length, 3);
        assert.ok(!pending[0].isMarker, 'single thread should not have summary marker');
    });

    test('flushThreadDump should emit buffered lines', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        processLineForThreadDump(state, makeLine('t2'), '--- worker ---', pending);
        assert.strictEqual(pending.length, 0, 'should be buffered');
        flushThreadDump(state, pending);
        assert.strictEqual(pending.length, 3, 'summary + 2 headers');
        assert.ok(pending[0].isMarker);
    });

    test('markers should flush buffered dump', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        processLineForThreadDump(state, makeLine('t2'), '"worker" tid=2 Waiting', pending);
        processLineForThreadDump(state, makeLine('marker', true), '--- MARKER ---', pending);
        // Flushed: summary + 2 headers + marker = 4
        assert.strictEqual(pending.length, 4);
        assert.ok(pending[0].isMarker, 'first should be summary');
        assert.ok(pending[3].isMarker, 'last should be the original marker');
    });

    test('should detect ANR pattern: main Runnable + worker Waiting', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        processLineForThreadDump(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        processLineForThreadDump(state, makeLine('t2'), '"AsyncTask #1" tid=12 Waiting', pending);
        processLineForThreadDump(state, makeLine('f2'), '    at java.lang.Object.wait(Native Method)', pending);
        flushThreadDump(state, pending);
        assert.ok(pending[0].text.includes('ANR pattern detected'), 'summary should flag ANR');
        assert.ok(pending[3].text.includes('\u26a0'), 'blocking thread should have warning badge');
    });

    test('should not flag ANR when all threads are Waiting', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Waiting', pending);
        processLineForThreadDump(state, makeLine('t2'), '"worker" tid=2 Waiting', pending);
        flushThreadDump(state, pending);
        assert.ok(!pending[0].text.includes('ANR'), 'no ANR when main is not Runnable');
    });

    test('should not flag ANR for single thread dump', () => {
        const state = createThreadDumpState();
        const pending: PendingLine[] = [];
        processLineForThreadDump(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        processLineForThreadDump(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        flushThreadDump(state, pending);
        // Single thread — no summary, no ANR analysis
        assert.strictEqual(pending.length, 2);
        assert.ok(!pending[0].isMarker);
    });
});
