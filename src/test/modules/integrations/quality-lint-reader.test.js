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
const quality_lint_reader_1 = require("../../../modules/integrations/providers/quality-lint-reader");
suite('QualityLintReader', () => {
    const makeEntry = (filePath, messages) => ({ filePath, messages });
    // --- Basic parsing ---
    test('should parse ESLint JSON with multiple files', () => {
        const refs = new Set(['src/foo.ts', 'src/bar.ts']);
        const json = JSON.stringify([
            makeEntry('src/foo.ts', [
                { severity: 1, message: 'no-unused-vars' },
                { severity: 2, message: 'no-undef' },
            ]),
            makeEntry('src/bar.ts', [
                { severity: 1, message: 'semi' },
            ]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        assert.strictEqual(result.size, 2);
        const foo = result.get('src/foo.ts');
        assert.strictEqual(foo?.warnings, 1);
        assert.strictEqual(foo?.errors, 1);
        const bar = result.get('src/bar.ts');
        assert.strictEqual(bar?.warnings, 1);
        assert.strictEqual(bar?.errors, 0);
    });
    test('should filter to only referenced files', () => {
        const refs = new Set(['src/foo.ts']);
        const json = JSON.stringify([
            makeEntry('src/foo.ts', [{ severity: 1, message: 'warn' }]),
            makeEntry('src/ignored.ts', [{ severity: 2, message: 'err' }]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('src/foo.ts'));
    });
    test('should count severity 1 as warning and severity 2 as error', () => {
        const refs = new Set(['src/app.ts']);
        const json = JSON.stringify([
            makeEntry('src/app.ts', [
                { severity: 1, message: 'a' },
                { severity: 1, message: 'b' },
                { severity: 2, message: 'c' },
                { severity: 2, message: 'd' },
                { severity: 2, message: 'e' },
            ]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        const data = result.get('src/app.ts');
        assert.strictEqual(data?.warnings, 2);
        assert.strictEqual(data?.errors, 3);
    });
    test('should extract top 3 messages only', () => {
        const refs = new Set(['src/app.ts']);
        const messages = Array.from({ length: 5 }, (_, i) => ({ severity: 1, message: `msg-${i}` }));
        const json = JSON.stringify([makeEntry('src/app.ts', messages)]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        const data = result.get('src/app.ts');
        assert.strictEqual(data?.topMessages.length, 3);
        assert.deepStrictEqual([...data.topMessages], ['msg-0', 'msg-1', 'msg-2']);
    });
    // --- Edge cases ---
    test('should handle empty messages array', () => {
        const refs = new Set(['src/empty.ts']);
        const json = JSON.stringify([makeEntry('src/empty.ts', [])]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        const data = result.get('src/empty.ts');
        assert.strictEqual(data?.warnings, 0);
        assert.strictEqual(data?.errors, 0);
        assert.strictEqual(data?.topMessages.length, 0);
    });
    test('should return empty map for invalid JSON', () => {
        const result = (0, quality_lint_reader_1.parseEslintJson)('not valid json', new Set(['anything']));
        assert.strictEqual(result.size, 0);
    });
    test('should return empty map for non-array JSON', () => {
        const result = (0, quality_lint_reader_1.parseEslintJson)('{"key": "value"}', new Set(['anything']));
        assert.strictEqual(result.size, 0);
    });
    test('should return empty map when no referenced files match', () => {
        const json = JSON.stringify([
            makeEntry('src/other.ts', [{ severity: 1, message: 'warn' }]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, new Set(['src/mine.ts']));
        assert.strictEqual(result.size, 0);
    });
    // --- Path normalization ---
    test('should match files with suffix path matching', () => {
        const refs = new Set(['src/foo.ts']);
        const json = JSON.stringify([
            makeEntry('/home/user/project/src/foo.ts', [
                { severity: 1, message: 'warn' },
            ]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('src/foo.ts'));
    });
    test('should normalize Windows backslash paths', () => {
        const refs = new Set(['src/bar.ts']);
        const json = JSON.stringify([
            makeEntry('C:\\Users\\dev\\src\\bar.ts', [
                { severity: 2, message: 'error' },
            ]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('src/bar.ts'));
    });
    test('should skip entries with missing filePath or messages', () => {
        const refs = new Set(['src/foo.ts']);
        const json = JSON.stringify([
            { messages: [{ severity: 1, message: 'x' }] },
            { filePath: 'src/foo.ts' },
            makeEntry('src/foo.ts', [{ severity: 1, message: 'valid' }]),
        ]);
        const result = (0, quality_lint_reader_1.parseEslintJson)(json, refs);
        assert.strictEqual(result.size, 1);
        assert.strictEqual(result.get('src/foo.ts')?.warnings, 1);
    });
});
//# sourceMappingURL=quality-lint-reader.test.js.map