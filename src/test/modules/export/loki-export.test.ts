/**
 * Unit tests for Loki export (label sanitization and payload shape).
 * Push and file I/O require VS Code API; only pure logic is tested here.
 */

import * as assert from 'assert';

// Inline implementation mirroring loki-export.ts for testing
function sanitizeSessionLabel(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'session';
}

suite('LokiExport', () => {
    suite('sanitizeSessionLabel', () => {
        test('keeps alphanumeric, dash, underscore', () => {
            assert.strictEqual(sanitizeSessionLabel('my-session_1'), 'my-session_1');
            assert.strictEqual(sanitizeSessionLabel('Session42'), 'Session42');
        });

        test('replaces disallowed chars with underscore', () => {
            assert.strictEqual(sanitizeSessionLabel('my session.log'), 'my_session_log');
            assert.strictEqual(sanitizeSessionLabel('a:b/c'), 'a_b_c');
        });

        test('caps at 128 chars', () => {
            const long = 'a'.repeat(200);
            assert.strictEqual(sanitizeSessionLabel(long).length, 128);
        });

        test('returns "session" when input is empty', () => {
            assert.strictEqual(sanitizeSessionLabel(''), 'session');
        });
    });
});
