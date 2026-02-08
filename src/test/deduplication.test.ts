import * as assert from 'assert';
import { Deduplicator } from '../modules/deduplication';

suite('Deduplicator', () => {

    suite('process', () => {

        test('should emit a new unique line immediately', () => {
            const dedup = new Deduplicator();
            const result = dedup.process('hello');
            assert.deepStrictEqual(result, ['hello']);
        });

        test('should suppress duplicate within time window', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.process('hello');
            assert.deepStrictEqual(result, []);
        });

        test('should emit grouped line when different line follows duplicates', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            dedup.process('hello');
            dedup.process('hello');
            const result = dedup.process('world');
            assert.deepStrictEqual(result, ['hello (x3)', 'world']);
        });

        test('should not group when count is 1', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.process('world');
            assert.deepStrictEqual(result, ['world']);
        });

        test('should handle interspersed different lines', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            assert.deepStrictEqual(dedup.process('a'), ['a']);
            assert.deepStrictEqual(dedup.process('b'), ['b']);
            assert.deepStrictEqual(dedup.process('a'), ['a']);
        });

        test('should handle empty strings', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            assert.deepStrictEqual(dedup.process(''), ['']);
            assert.deepStrictEqual(dedup.process(''), []);
        });

        test('should treat lines differing by whitespace as different', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.process('hello ');
            assert.deepStrictEqual(result, ['hello ']);
        });
    });

    suite('flush', () => {

        test('should emit grouped line when duplicates are pending', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('error');
            dedup.process('error');
            dedup.process('error');
            const result = dedup.flush();
            assert.deepStrictEqual(result, ['error (x3)']);
        });

        test('should return empty when last line has count 1', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('hello');
            const result = dedup.flush();
            assert.deepStrictEqual(result, []);
        });

        test('should return empty when no lines processed', () => {
            const dedup = new Deduplicator();
            assert.deepStrictEqual(dedup.flush(), []);
        });

        test('should reset state after flush', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('error');
            dedup.process('error');
            dedup.flush();
            // After flush, processing a new line should start fresh
            const result = dedup.process('error');
            assert.deepStrictEqual(result, ['error']);
        });
    });

    suite('reset', () => {

        test('should clear all state', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('error');
            dedup.process('error');
            dedup.reset();
            // After reset, same line should be treated as new
            const result = dedup.process('error');
            assert.deepStrictEqual(result, ['error']);
        });
    });

    suite('time window behavior', () => {

        test('should finalize group and start fresh after window expires', (done) => {
            const dedup = new Deduplicator({ windowMs: 50 });
            dedup.process('hello');
            // Second call within window — suppressed (proves grouping works)
            assert.deepStrictEqual(dedup.process('hello'), []);
            setTimeout(() => {
                // After window expires: finalizes pending group, then emits new line
                const result = dedup.process('hello');
                assert.deepStrictEqual(result, ['hello (x2)', 'hello']);
                done();
            }, 80);
        });
    });

    suite('formatting', () => {

        test('should format count suffix correctly', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            dedup.process('msg');
            dedup.process('msg');
            const result = dedup.process('other');
            assert.strictEqual(result[0], 'msg (x2)');
        });

        test('should format large counts correctly', () => {
            const dedup = new Deduplicator({ windowMs: 5000 });
            for (let i = 0; i < 100; i++) {
                dedup.process('flood');
            }
            const result = dedup.flush();
            assert.deepStrictEqual(result, ['flood (x100)']);
        });
    });
});
