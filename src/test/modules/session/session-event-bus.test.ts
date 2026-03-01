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

    test('caps at maxEarlyBuffer (500) per session', () => {
        const buf = new EarlyOutputBuffer();
        for (let i = 0; i < 600; i++) {
            buf.add('s1', body(`line ${i}`));
        }
        const drained = buf.drain('s1');
        assert.strictEqual(drained.length, 500);
        assert.strictEqual(drained[0].output, 'line 0');
        assert.strictEqual(drained[499].output, 'line 499');
    });
});
