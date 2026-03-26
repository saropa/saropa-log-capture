import * as assert from 'assert';
import { parseBrowserSidecarToPending } from '../../ui/viewer/viewer-file-loader-sources';

suite('parseBrowserSidecarToPending', () => {
    test('should parse array of browser events', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, level: 'error', message: 'Uncaught TypeError' },
            { timestamp: 1700000001000, level: 'log', message: 'Page loaded' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].source, 'browser');
        assert.strictEqual(result[0].timestamp, 1700000000000);
        assert.ok(result[0].text.includes('[error] Uncaught TypeError'));
        assert.strictEqual(result[1].timestamp, 1700000001000);
        assert.ok(result[1].text.includes('[log] Page loaded'));
    });

    test('should accept { events: [...] } wrapper format', () => {
        const content = JSON.stringify({
            events: [{ timestamp: 1700000000000, level: 'warn', message: 'Deprecated API' }],
        });
        const result = parseBrowserSidecarToPending(content);
        assert.strictEqual(result.length, 1);
        assert.ok(result[0].text.includes('[warn] Deprecated API'));
    });

    test('should use text field as fallback for message', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, text: 'from text field' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.strictEqual(result.length, 1);
        assert.ok(result[0].text.includes('from text field'));
    });

    test('should use type field as fallback for level', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, message: 'x', type: 'warning' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.ok(result[0].text.includes('[warning]'));
    });

    test('should default level to log when absent', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, message: 'no level' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.ok(result[0].text.includes('[log]'));
    });

    test('should append url when present', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, message: 'x', url: 'http://test.com' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.ok(result[0].text.includes('(http://test.com)'));
    });

    test('should append url with lineNumber when both present', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, message: 'x', url: 'http://test.com/app.js', lineNumber: 42 },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.ok(result[0].text.includes('(http://test.com/app.js:42)'));
    });

    test('should skip events with no message or text', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, level: 'info' },
            { timestamp: 1700000000000, message: 'has text' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.strictEqual(result.length, 1);
    });

    test('should set timestamp to 0 when missing', () => {
        const content = JSON.stringify([
            { message: 'no timestamp' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].timestamp, 0);
    });

    test('should return empty for malformed JSON', () => {
        const result = parseBrowserSidecarToPending('not json{{{');
        assert.deepStrictEqual(result, []);
    });

    test('should return empty for empty array', () => {
        const result = parseBrowserSidecarToPending('[]');
        assert.deepStrictEqual(result, []);
    });

    test('should set category to console and isMarker to false', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, message: 'test' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.strictEqual(result[0].category, 'console');
        assert.strictEqual(result[0].isMarker, false);
    });

    test('should HTML-escape message content', () => {
        const content = JSON.stringify([
            { timestamp: 1700000000000, message: '<script>alert("xss")</script>' },
        ]);
        const result = parseBrowserSidecarToPending(content);
        assert.ok(!result[0].text.includes('<script>'));
        assert.ok(result[0].text.includes('&lt;script&gt;'));
    });
});
