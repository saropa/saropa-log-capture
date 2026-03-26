"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const error_fingerprint_1 = require("../../../modules/analysis/error-fingerprint");
suite('ErrorFingerprint', () => {
    suite('normalizeLine', () => {
        test('should return plain text unchanged', () => {
            assert.strictEqual((0, error_fingerprint_1.normalizeLine)('simple text'), 'simple text');
        });
        test('should strip ANSI codes', () => {
            assert.strictEqual((0, error_fingerprint_1.normalizeLine)('\x1b[31merror\x1b[0m'), 'error');
        });
        test('should strip leading timestamp brackets', () => {
            assert.strictEqual((0, error_fingerprint_1.normalizeLine)('[12:30:45.123] error occurred'), 'error occurred');
        });
        test('should replace ISO timestamps with <TS>', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('at 2024-01-15T12:30:45.123 error');
            assert.strictEqual(result, 'at <TS> error');
        });
        test('should replace date-time timestamps with <TS>', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('at 2024-01-15 12:30:45 error');
            assert.strictEqual(result, 'at <TS> error');
        });
        test('should replace UUIDs with <UUID>', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('request a1b2c3d4-e5f6-7890-abcd-ef1234567890 failed');
            assert.strictEqual(result, 'request <UUID> failed');
        });
        test('should replace hex addresses with <HEX>', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('at 0xDEADBEEF in module');
            assert.strictEqual(result, 'at <HEX> in module');
        });
        test('should replace multi-digit numbers with <N>', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('port 8080 connection refused');
            assert.strictEqual(result, 'port <N> connection refused');
        });
        test('should not replace single-digit numbers', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('retry 1 of 3');
            assert.ok(result.includes('1'));
            assert.ok(result.includes('3'));
        });
        test('should strip file paths', () => {
            const result = (0, error_fingerprint_1.normalizeLine)('error in /usr/local/bin/app.js');
            assert.ok(!result.includes('/usr/local/bin/'));
        });
        test('should collapse whitespace', () => {
            assert.strictEqual((0, error_fingerprint_1.normalizeLine)('  too   many  spaces  '), 'too many spaces');
        });
        test('should handle empty string', () => {
            assert.strictEqual((0, error_fingerprint_1.normalizeLine)(''), '');
        });
        test('should handle combined normalizations', () => {
            const input = '[2024-01-15T10:30:00] Error at 0xABCD1234: request a1b2c3d4-e5f6-7890-abcd-ef1234567890 on port 3000';
            const result = (0, error_fingerprint_1.normalizeLine)(input);
            assert.ok(result.includes('<HEX>'));
            assert.ok(result.includes('<UUID>'));
            assert.ok(result.includes('<N>'));
            assert.ok(!result.includes('2024'));
        });
    });
    suite('hashFingerprint', () => {
        test('should return 8-char hex string', () => {
            const hash = (0, error_fingerprint_1.hashFingerprint)('test');
            assert.strictEqual(hash.length, 8);
            assert.ok(/^[0-9a-f]{8}$/.test(hash));
        });
        test('should produce deterministic results', () => {
            const hash1 = (0, error_fingerprint_1.hashFingerprint)('error occurred');
            const hash2 = (0, error_fingerprint_1.hashFingerprint)('error occurred');
            assert.strictEqual(hash1, hash2);
        });
        test('should produce different hashes for different inputs', () => {
            const hash1 = (0, error_fingerprint_1.hashFingerprint)('error A');
            const hash2 = (0, error_fingerprint_1.hashFingerprint)('error B');
            assert.notStrictEqual(hash1, hash2);
        });
        test('should handle empty string', () => {
            const hash = (0, error_fingerprint_1.hashFingerprint)('');
            assert.strictEqual(hash.length, 8);
            assert.ok(/^[0-9a-f]{8}$/.test(hash));
        });
        test('should handle long strings', () => {
            const long = 'a'.repeat(10000);
            const hash = (0, error_fingerprint_1.hashFingerprint)(long);
            assert.strictEqual(hash.length, 8);
            assert.ok(/^[0-9a-f]{8}$/.test(hash));
        });
    });
});
//# sourceMappingURL=error-fingerprint.test.js.map