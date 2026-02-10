import * as assert from 'assert';
import { parseThreadHeader } from '../modules/stack-parser';

suite('parseThreadHeader', () => {

    test('should parse quoted thread name with tid and state', () => {
        const result = parseThreadHeader('"main" tid=1 Runnable');
        assert.ok(result);
        assert.strictEqual(result.name, 'main');
        assert.strictEqual(result.tid, 1);
        assert.strictEqual(result.state, 'Runnable');
    });

    test('should parse thread with prio and tid', () => {
        const result = parseThreadHeader('"AsyncTask #1" prio=5 tid=12 Waiting');
        assert.ok(result);
        assert.strictEqual(result.name, 'AsyncTask #1');
        assert.strictEqual(result.tid, 12);
        assert.strictEqual(result.state, 'Waiting');
    });

    test('should parse dash-delimited thread header', () => {
        const result = parseThreadHeader('--- main ---');
        assert.ok(result);
        assert.strictEqual(result.name, 'main');
        assert.strictEqual(result.tid, undefined);
        assert.strictEqual(result.state, undefined);
    });

    test('should return undefined for regular stack frame', () => {
        assert.strictEqual(parseThreadHeader('    at com.example.MyClass.method(MyClass.java:42)'), undefined);
    });

    test('should return undefined for regular log line', () => {
        assert.strictEqual(parseThreadHeader('D/Flutter ( 1234): Hello world'), undefined);
    });

    test('should return undefined for empty string', () => {
        assert.strictEqual(parseThreadHeader(''), undefined);
    });

    test('should return undefined for very long string', () => {
        assert.strictEqual(parseThreadHeader('x'.repeat(250)), undefined);
    });

    test('should handle leading/trailing whitespace', () => {
        const result = parseThreadHeader('  "worker-1" tid=3 Blocked  ');
        assert.ok(result);
        assert.strictEqual(result.name, 'worker-1');
        assert.strictEqual(result.tid, 3);
        assert.strictEqual(result.state, 'Blocked');
    });
});
