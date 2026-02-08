import * as assert from 'assert';
import { normalizeLine, hashFingerprint } from '../modules/error-fingerprint';

suite('ErrorFingerprint', () => {

    suite('normalizeLine', () => {

        test('should return plain text unchanged', () => {
            assert.strictEqual(normalizeLine('simple text'), 'simple text');
        });

        test('should strip ANSI codes', () => {
            assert.strictEqual(normalizeLine('\x1b[31merror\x1b[0m'), 'error');
        });

        test('should strip leading timestamp brackets', () => {
            assert.strictEqual(
                normalizeLine('[12:30:45.123] error occurred'),
                'error occurred',
            );
        });

        test('should replace ISO timestamps with <TS>', () => {
            const result = normalizeLine('at 2024-01-15T12:30:45.123 error');
            assert.strictEqual(result, 'at <TS> error');
        });

        test('should replace date-time timestamps with <TS>', () => {
            const result = normalizeLine('at 2024-01-15 12:30:45 error');
            assert.strictEqual(result, 'at <TS> error');
        });

        test('should replace UUIDs with <UUID>', () => {
            const result = normalizeLine(
                'request a1b2c3d4-e5f6-7890-abcd-ef1234567890 failed',
            );
            assert.strictEqual(result, 'request <UUID> failed');
        });

        test('should replace hex addresses with <HEX>', () => {
            const result = normalizeLine('at 0xDEADBEEF in module');
            assert.strictEqual(result, 'at <HEX> in module');
        });

        test('should replace multi-digit numbers with <N>', () => {
            const result = normalizeLine('port 8080 connection refused');
            assert.strictEqual(result, 'port <N> connection refused');
        });

        test('should not replace single-digit numbers', () => {
            const result = normalizeLine('retry 1 of 3');
            assert.ok(result.includes('1'));
            assert.ok(result.includes('3'));
        });

        test('should strip file paths', () => {
            const result = normalizeLine('error in /usr/local/bin/app.js');
            assert.ok(!result.includes('/usr/local/bin/'));
        });

        test('should collapse whitespace', () => {
            assert.strictEqual(normalizeLine('  too   many  spaces  '), 'too many spaces');
        });

        test('should handle empty string', () => {
            assert.strictEqual(normalizeLine(''), '');
        });

        test('should handle combined normalizations', () => {
            const input = '[2024-01-15T10:30:00] Error at 0xABCD1234: request a1b2c3d4-e5f6-7890-abcd-ef1234567890 on port 3000';
            const result = normalizeLine(input);
            assert.ok(result.includes('<HEX>'));
            assert.ok(result.includes('<UUID>'));
            assert.ok(result.includes('<N>'));
            assert.ok(!result.includes('2024'));
        });
    });

    suite('hashFingerprint', () => {

        test('should return 8-char hex string', () => {
            const hash = hashFingerprint('test');
            assert.strictEqual(hash.length, 8);
            assert.ok(/^[0-9a-f]{8}$/.test(hash));
        });

        test('should produce deterministic results', () => {
            const hash1 = hashFingerprint('error occurred');
            const hash2 = hashFingerprint('error occurred');
            assert.strictEqual(hash1, hash2);
        });

        test('should produce different hashes for different inputs', () => {
            const hash1 = hashFingerprint('error A');
            const hash2 = hashFingerprint('error B');
            assert.notStrictEqual(hash1, hash2);
        });

        test('should handle empty string', () => {
            const hash = hashFingerprint('');
            assert.strictEqual(hash.length, 8);
            assert.ok(/^[0-9a-f]{8}$/.test(hash));
        });

        test('should handle long strings', () => {
            const long = 'a'.repeat(10000);
            const hash = hashFingerprint(long);
            assert.strictEqual(hash.length, 8);
            assert.ok(/^[0-9a-f]{8}$/.test(hash));
        });
    });
});
