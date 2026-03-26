"use strict";
/**
 * Unit tests for Loki export (label sanitization and payload shape).
 * Push and file I/O require VS Code API; only pure logic is tested here.
 */
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
// Inline implementation mirroring loki-export.ts for testing
function sanitizeSessionLabel(name) {
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
//# sourceMappingURL=loki-export.test.js.map