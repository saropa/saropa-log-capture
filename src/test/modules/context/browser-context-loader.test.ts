import * as assert from 'assert';
import { loadBrowserContext } from '../../../modules/context/context-sidecar-parsers';

/** Use realistic epoch-ms timestamps so extractTimestamp() doesn't convert. */
const T = 1700000000000;
const WINDOW = { centerTime: T, windowMs: 5000 };

suite('loadBrowserContext', () => {
    test('should return events within time window', () => {
        const content = JSON.stringify([
            { timestamp: T - 2000, level: 'error', message: 'fail' },
            { timestamp: T + 2000, level: 'log', message: 'ok' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.length, 2);
        assert.strictEqual(result.browser?.[0].message, 'fail');
        assert.strictEqual(result.browser?.[0].level, 'error');
    });

    test('should filter out events outside time window', () => {
        const content = JSON.stringify([
            { timestamp: T - 90000, level: 'log', message: 'too early' },
            { timestamp: T, level: 'log', message: 'in window' },
            { timestamp: T + 90000, level: 'log', message: 'too late' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
        assert.strictEqual(result.browser?.[0].message, 'in window');
    });

    test('should accept { events: [...] } format', () => {
        const content = JSON.stringify({
            events: [{ timestamp: T, level: 'warn', message: 'wrapped' }],
        });
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
        assert.strictEqual(result.browser?.[0].message, 'wrapped');
    });

    test('should use text field as fallback for message', () => {
        const content = JSON.stringify([
            { timestamp: T, text: 'from text' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.[0].message, 'from text');
    });

    test('should use type field as fallback for level', () => {
        const content = JSON.stringify([
            { timestamp: T, message: 'x', type: 'warning' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.[0].level, 'warning');
    });

    test('should include url when present', () => {
        const content = JSON.stringify([
            { timestamp: T, message: 'x', url: 'http://test.com' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.[0].url, 'http://test.com');
    });

    test('should skip events with no message or text', () => {
        const content = JSON.stringify([
            { timestamp: T, level: 'info' },
            { timestamp: T, message: 'has text' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
    });

    test('should skip events with no timestamp', () => {
        const content = JSON.stringify([
            { message: 'no time' },
            { timestamp: T, message: 'has time' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.length, 1);
    });

    test('should return empty for malformed JSON', () => {
        const result = loadBrowserContext('not json{{{', WINDOW);
        assert.deepStrictEqual(result, {});
    });

    test('should return empty for empty array', () => {
        const result = loadBrowserContext('[]', WINDOW);
        assert.deepStrictEqual(result, {});
    });

    test('should cap at 30 events', () => {
        const events = Array.from({ length: 50 }, (_, i) => ({
            timestamp: T + i,
            message: `event ${i}`,
        }));
        const result = loadBrowserContext(JSON.stringify(events), WINDOW);
        assert.strictEqual(result.browser?.length, 30);
    });

    test('should sort events by timestamp', () => {
        const content = JSON.stringify([
            { timestamp: T + 4000, message: 'later' },
            { timestamp: T - 2000, message: 'earlier' },
        ]);
        const result = loadBrowserContext(content, WINDOW);
        assert.strictEqual(result.browser?.[0].message, 'earlier');
        assert.strictEqual(result.browser?.[1].message, 'later');
    });
});
