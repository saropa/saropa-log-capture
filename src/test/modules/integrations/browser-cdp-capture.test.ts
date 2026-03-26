import * as assert from 'assert';
import { mapConsoleEvent, mapNetworkEvent, isLocalhostUrl } from '../../../modules/integrations/providers/browser-cdp-capture';

suite('CDP capture — mapConsoleEvent', () => {
    test('should map log event with string args', () => {
        const result = mapConsoleEvent({
            type: 'log',
            args: [{ value: 'hello' }, { value: 'world' }],
            timestamp: 1700000000.123,
        });
        assert.strictEqual(result?.message, 'hello world');
        assert.strictEqual(result?.level, 'log');
        assert.strictEqual(result?.timestamp, 1700000000123);
    });

    test('should map error event', () => {
        const result = mapConsoleEvent({
            type: 'error',
            args: [{ value: 'Something failed' }],
            timestamp: 1700000001.0,
        });
        assert.strictEqual(result?.level, 'error');
        assert.strictEqual(result?.message, 'Something failed');
    });

    test('should use description when value is undefined', () => {
        const result = mapConsoleEvent({
            type: 'log',
            args: [{ description: 'Object { x: 1 }' }],
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.message, 'Object { x: 1 }');
    });

    test('should extract url and lineNumber from stackTrace', () => {
        const result = mapConsoleEvent({
            type: 'log',
            args: [{ value: 'test' }],
            timestamp: 1700000000.0,
            stackTrace: {
                callFrames: [{ url: 'http://localhost:3000/app.js', lineNumber: 42 }],
            },
        });
        assert.strictEqual(result?.url, 'http://localhost:3000/app.js');
        assert.strictEqual(result?.lineNumber, 42);
    });

    test('should return undefined for empty args', () => {
        assert.strictEqual(mapConsoleEvent({ type: 'log', args: [] }), undefined);
    });

    test('should return undefined for missing args', () => {
        assert.strictEqual(mapConsoleEvent({ type: 'log' }), undefined);
    });

    test('should use Date.now() when timestamp is missing', () => {
        const before = Date.now();
        const result = mapConsoleEvent({ type: 'log', args: [{ value: 'x' }] });
        const after = Date.now();
        assert.ok(result);
        assert.ok(result.timestamp! >= before && result.timestamp! <= after);
    });

    test('should default level to log when type is missing', () => {
        const result = mapConsoleEvent({ args: [{ value: 'test' }], timestamp: 1700000000.0 });
        assert.strictEqual(result?.level, 'log');
    });
});

suite('CDP capture — mapNetworkEvent', () => {
    test('should map 200 response as info', () => {
        const result = mapNetworkEvent({
            response: { url: 'http://localhost:3000/api/data', status: 200 },
            timestamp: 1700000000.5,
        });
        assert.strictEqual(result?.message, 'HTTP 200 http://localhost:3000/api/data');
        assert.strictEqual(result?.level, 'info');
        assert.strictEqual(result?.timestamp, 1700000000500);
    });

    test('should map 500 response as error', () => {
        const result = mapNetworkEvent({
            response: { url: 'http://localhost:3000/api/fail', status: 500 },
            timestamp: 1700000001.0,
        });
        assert.strictEqual(result?.level, 'error');
    });

    test('should map 404 response as error', () => {
        const result = mapNetworkEvent({
            response: { url: '/missing', status: 404 },
            timestamp: 1700000000.0,
        });
        assert.strictEqual(result?.level, 'error');
    });

    test('should return undefined when response has no url', () => {
        assert.strictEqual(mapNetworkEvent({ response: { status: 200 } }), undefined);
    });

    test('should return undefined when response is missing', () => {
        assert.strictEqual(mapNetworkEvent({ timestamp: 1700000000.0 }), undefined);
    });
});

suite('CDP capture — isLocalhostUrl', () => {
    test('should accept localhost', () => {
        assert.strictEqual(isLocalhostUrl('ws://localhost:9222'), true);
    });

    test('should accept 127.0.0.1', () => {
        assert.strictEqual(isLocalhostUrl('ws://127.0.0.1:9222'), true);
    });

    test('should accept ::1', () => {
        assert.strictEqual(isLocalhostUrl('ws://[::1]:9222'), true);
    });

    test('should reject external host', () => {
        assert.strictEqual(isLocalhostUrl('ws://evil.com:9222'), false);
    });

    test('should reject 192.168 addresses', () => {
        assert.strictEqual(isLocalhostUrl('ws://192.168.1.1:9222'), false);
    });

    test('should return false for invalid URL', () => {
        assert.strictEqual(isLocalhostUrl('not-a-url'), false);
    });
});
