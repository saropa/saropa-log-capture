import * as assert from 'assert';
import { EarlyOutputBuffer } from '../../../modules/session/session-event-bus';
import type { DapOutputBody } from '../../../modules/capture/tracker';

function body(output: string, category?: string): DapOutputBody {
    return { output, category: category ?? 'console' };
}

suite('EarlyOutputBuffer', () => {

    test('add and drain return buffered events', () => {
        const buf = new EarlyOutputBuffer();
        buf.add('s1', body('a'));
        buf.add('s1', body('b'));
        const drained = buf.drain('s1');
        assert.strictEqual(drained.length, 2);
        assert.strictEqual(drained[0].output, 'a');
        assert.strictEqual(drained[1].output, 'b');
    });

    test('drain removes session from buffer', () => {
        const buf = new EarlyOutputBuffer();
        buf.add('s1', body('x'));
        buf.drain('s1');
        assert.strictEqual(buf.drain('s1').length, 0);
    });

    test('drain returns empty array for unknown session', () => {
        const buf = new EarlyOutputBuffer();
        assert.deepStrictEqual(buf.drain('unknown'), []);
    });

    test('delete removes session without returning', () => {
        const buf = new EarlyOutputBuffer();
        buf.add('s1', body('x'));
        buf.delete('s1');
        assert.strictEqual(buf.drain('s1').length, 0);
    });

    test('clear removes all sessions', () => {
        const buf = new EarlyOutputBuffer();
        buf.add('s1', body('a'));
        buf.add('s2', body('b'));
        buf.clear();
        assert.strictEqual(buf.drain('s1').length, 0);
        assert.strictEqual(buf.drain('s2').length, 0);
    });

    test('sessions are buffered independently', () => {
        const buf = new EarlyOutputBuffer();
        buf.add('s1', body('one'));
        buf.add('s2', body('two'));
        buf.add('s1', body('three'));
        assert.strictEqual(buf.drain('s1').length, 2);
        assert.strictEqual(buf.drain('s2').length, 1);
    });

    test('caps at maxEarlyBuffer (500) and appends a drop notice for the overflow (M2)', () => {
        const buf = new EarlyOutputBuffer();
        for (let i = 0; i < 600; i++) {
            buf.add('s1', body(`line ${i}`));
        }
        const drained = buf.drain('s1');
        // 500 kept (the earliest) + 1 synthetic notice describing the 100 dropped lines.
        assert.strictEqual(drained.length, 501);
        assert.strictEqual(drained[0].output, 'line 0');
        assert.strictEqual(drained[499].output, 'line 499');
        assert.match(drained[500].output, /100 early output lines dropped/);
    });

    test('under the cap there is no drop notice', () => {
        const buf = new EarlyOutputBuffer();
        for (let i = 0; i < 500; i++) { buf.add('s1', body(`line ${i}`)); }
        const drained = buf.drain('s1');
        assert.strictEqual(drained.length, 500);
        assert.ok(!drained.some(b => /dropped before capture/.test(b.output)));
    });

    test('drainAll appends the drop notice per overflowing session (M2)', () => {
        const buf = new EarlyOutputBuffer();
        for (let i = 0; i < 501; i++) { buf.add('s1', body(`a${i}`)); }
        buf.add('s2', body('b'));
        const all = buf.drainAll();
        assert.strictEqual(all.get('s1')!.length, 501); // 500 kept + 1 notice (1 dropped)
        assert.match(all.get('s1')![500].output, /1 early output line dropped/);
        assert.strictEqual(all.get('s2')!.length, 1); // no overflow → no notice
    });

    test('drainAll returns all sessions and clears buffer', () => {
        const buf = new EarlyOutputBuffer();
        buf.add('s1', body('a'));
        buf.add('s2', body('b'));
        buf.add('s1', body('c'));
        const all = buf.drainAll();
        assert.strictEqual(all.size, 2);
        assert.strictEqual(all.get('s1')!.length, 2);
        assert.strictEqual(all.get('s2')!.length, 1);
        assert.strictEqual(all.get('s1')![0].output, 'a');
        assert.strictEqual(all.get('s1')![1].output, 'c');
        assert.strictEqual(all.get('s2')![0].output, 'b');
        assert.strictEqual(buf.drain('s1').length, 0);
        assert.strictEqual(buf.drain('s2').length, 0);
    });
});
