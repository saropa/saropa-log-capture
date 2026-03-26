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
const log_search_1 = require("../../../modules/search/log-search");
suite('LogSearch', () => {
    test('should return empty results when no workspace', async () => {
        // Without a workspace, should return empty results
        const results = await (0, log_search_1.searchLogFiles)('test');
        assert.strictEqual(results.matches.length, 0);
        assert.strictEqual(results.totalFiles, 0);
    });
    test('should handle empty query gracefully', async () => {
        const results = await (0, log_search_1.searchLogFiles)('');
        assert.strictEqual(results.matches.length, 0);
        assert.strictEqual(results.query, '');
    });
    test('should respect case sensitivity option', async () => {
        // With case sensitive, pattern should be different
        const results = await (0, log_search_1.searchLogFiles)('Test', { caseSensitive: true });
        assert.strictEqual(results.query, 'Test');
    });
    test('should handle regex option', async () => {
        // With regex option, should accept regex patterns
        const results = await (0, log_search_1.searchLogFiles)('test.*pattern', { useRegex: true });
        assert.strictEqual(results.query, 'test.*pattern');
    });
    test('should handle invalid regex gracefully', async () => {
        // Invalid regex should return empty results, not throw
        const results = await (0, log_search_1.searchLogFiles)('[invalid', { useRegex: true });
        assert.strictEqual(results.matches.length, 0);
    });
    test('should handle whole word option', async () => {
        const results = await (0, log_search_1.searchLogFiles)('error', { wholeWord: true });
        assert.strictEqual(results.query, 'error');
    });
});
suite('LogSearch Concurrent', () => {
    test('should return empty results when no workspace', async () => {
        const results = await (0, log_search_1.searchLogFilesConcurrent)('test');
        assert.strictEqual(results.files.length, 0);
        assert.strictEqual(results.totalFiles, 0);
        assert.strictEqual(results.totalMatches, 0);
    });
    test('should handle empty query gracefully', async () => {
        const results = await (0, log_search_1.searchLogFilesConcurrent)('');
        assert.strictEqual(results.files.length, 0);
        assert.strictEqual(results.query, '');
    });
    test('should handle invalid regex gracefully', async () => {
        const results = await (0, log_search_1.searchLogFilesConcurrent)('[invalid', { useRegex: true });
        assert.strictEqual(results.files.length, 0);
    });
    test('should pass through search options', async () => {
        const results = await (0, log_search_1.searchLogFilesConcurrent)('test', {
            caseSensitive: true,
            wholeWord: true,
            useRegex: false,
        });
        assert.strictEqual(results.query, 'test');
        assert.strictEqual(results.totalMatches, 0);
    });
});
//# sourceMappingURL=log-search.test.js.map