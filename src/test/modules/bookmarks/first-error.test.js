"use strict";
/**
 * Tests for first-error detection (smart bookmarks).
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
const first_error_1 = require("../../../modules/bookmarks/first-error");
suite('FirstError', () => {
    suite('findFirstErrorLines', () => {
        test('returns first error line index and snippet', () => {
            const lines = [
                '[12:00:00] [stdout] Info message',
                '[12:00:01] [stderr] Something failed',
                '[12:00:02] [stdout] Another error: null',
            ];
            const result = (0, first_error_1.findFirstErrorLines)(lines, { strict: false, includeWarning: false });
            assert.ok(result.firstError);
            assert.strictEqual(result.firstError.lineIndex, 1);
            assert.strictEqual(result.firstError.level, 'error');
            assert.ok(result.firstError.snippet.includes('failed') || result.firstError.lineText.includes('failed'));
        });
        test('uses content line format [time] [category] rest', () => {
            const lines = [
                '[12:00:00.123] [console] Normal output',
                '[12:00:01.456] [stdout] Error: connection refused',
            ];
            const result = (0, first_error_1.findFirstErrorLines)(lines, { strict: true, includeWarning: false });
            assert.ok(result.firstError);
            assert.strictEqual(result.firstError.lineIndex, 1);
            assert.strictEqual(result.firstError.level, 'error');
        });
        test('returns first warning when includeWarning true and no error', () => {
            const lines = [
                '[12:00:00] [stdout] Info',
                '[12:00:01] [stdout] Warning: deprecated API',
            ];
            const result = (0, first_error_1.findFirstErrorLines)(lines, { strict: false, includeWarning: true });
            assert.ok(!result.firstError);
            assert.ok(result.firstWarning);
            assert.strictEqual(result.firstWarning.lineIndex, 1);
            assert.strictEqual(result.firstWarning.level, 'warning');
        });
        test('returns empty when no error or warning', () => {
            const lines = [
                '[12:00:00] [stdout] Just info',
                '[12:00:01] [console] Debug trace',
            ];
            const result = (0, first_error_1.findFirstErrorLines)(lines, { strict: true, includeWarning: true });
            assert.ok(!result.firstError);
            assert.ok(!result.firstWarning);
        });
        test('skips marker lines', () => {
            const lines = [
                '--- MARKER: test ---',
                '[12:00:00] [stdout] Error: real error',
            ];
            const result = (0, first_error_1.findFirstErrorLines)(lines, { strict: false, includeWarning: false });
            assert.ok(result.firstError);
            assert.strictEqual(result.firstError.lineIndex, 1);
        });
    });
});
//# sourceMappingURL=first-error.test.js.map