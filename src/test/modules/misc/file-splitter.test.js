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
const file_splitter_1 = require("../../../modules/misc/file-splitter");
suite('FileSplitter', () => {
    test('should return default rules with all values disabled', () => {
        const defaults = (0, file_splitter_1.defaultSplitRules)();
        assert.strictEqual(defaults.maxLines, 0);
        assert.strictEqual(defaults.maxSizeKB, 0);
        assert.strictEqual(defaults.keywords.length, 0);
        assert.strictEqual(defaults.maxDurationMinutes, 0);
        assert.strictEqual(defaults.silenceMinutes, 0);
    });
    test('should not trigger split when no rules are active', () => {
        const splitter = new file_splitter_1.FileSplitter((0, file_splitter_1.defaultSplitRules)());
        const result = splitter.evaluate({
            lineCount: 10000,
            bytesWritten: 1000000,
            startTime: Date.now() - 3600000,
            lastLineTime: Date.now() - 600000,
        });
        assert.strictEqual(result.shouldSplit, false);
    });
    test('should trigger split when line count exceeds maxLines', () => {
        const rules = { ...(0, file_splitter_1.defaultSplitRules)(), maxLines: 100 };
        const splitter = new file_splitter_1.FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 100,
            bytesWritten: 1000,
            startTime: Date.now(),
            lastLineTime: Date.now(),
        });
        assert.strictEqual(result.shouldSplit, true);
        assert.strictEqual(result.reason?.type, 'lines');
    });
    test('should trigger split when size exceeds maxSizeKB', () => {
        const rules = { ...(0, file_splitter_1.defaultSplitRules)(), maxSizeKB: 100 };
        const splitter = new file_splitter_1.FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 10,
            bytesWritten: 102400, // 100 KB
            startTime: Date.now(),
            lastLineTime: Date.now(),
        });
        assert.strictEqual(result.shouldSplit, true);
        assert.strictEqual(result.reason?.type, 'size');
    });
    test('should trigger split when keyword is found', () => {
        const rules = { ...(0, file_splitter_1.defaultSplitRules)(), keywords: ['HOT RESTART'] };
        const splitter = new file_splitter_1.FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 10,
            bytesWritten: 1000,
            startTime: Date.now(),
            lastLineTime: Date.now(),
        }, 'Performing HOT RESTART...');
        assert.strictEqual(result.shouldSplit, true);
        assert.strictEqual(result.reason?.type, 'keyword');
    });
    test('should support regex keywords', () => {
        const rules = { ...(0, file_splitter_1.defaultSplitRules)(), keywords: ['/restart/i'] };
        const splitter = new file_splitter_1.FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 10,
            bytesWritten: 1000,
            startTime: Date.now(),
            lastLineTime: Date.now(),
        }, 'Performing RESTART operation');
        assert.strictEqual(result.shouldSplit, true);
    });
    test('should not split when below thresholds', () => {
        const rules = { ...(0, file_splitter_1.defaultSplitRules)(), maxLines: 100, maxSizeKB: 100 };
        const splitter = new file_splitter_1.FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 50,
            bytesWritten: 10000,
            startTime: Date.now(),
            lastLineTime: Date.now(),
        });
        assert.strictEqual(result.shouldSplit, false);
    });
    test('hasActiveRules should return false for default rules', () => {
        const splitter = new file_splitter_1.FileSplitter((0, file_splitter_1.defaultSplitRules)());
        assert.strictEqual(splitter.hasActiveRules(), false);
    });
    test('hasActiveRules should return true when any rule is set', () => {
        const rules = { ...(0, file_splitter_1.defaultSplitRules)(), maxLines: 1000 };
        const splitter = new file_splitter_1.FileSplitter(rules);
        assert.strictEqual(splitter.hasActiveRules(), true);
    });
});
suite('formatSplitReason', () => {
    test('should format lines reason', () => {
        const result = (0, file_splitter_1.formatSplitReason)({ type: 'lines', count: 1000 });
        assert.ok(result.includes('1000'));
        assert.ok(result.includes('lines'));
    });
    test('should format size reason', () => {
        const result = (0, file_splitter_1.formatSplitReason)({ type: 'size', sizeKB: 500 });
        assert.ok(result.includes('500'));
        assert.ok(result.includes('KB'));
    });
    test('should format keyword reason', () => {
        const result = (0, file_splitter_1.formatSplitReason)({ type: 'keyword', keyword: 'HOT RESTART' });
        assert.ok(result.includes('HOT RESTART'));
    });
    test('should format manual reason', () => {
        const result = (0, file_splitter_1.formatSplitReason)({ type: 'manual' });
        assert.ok(result.includes('manual'));
    });
});
suite('parseSplitRules', () => {
    test('returns defaults for null', () => {
        const r = (0, file_splitter_1.parseSplitRules)(null);
        assert.strictEqual(r.maxLines, 0);
        assert.strictEqual(r.maxSizeKB, 0);
        assert.deepStrictEqual(r.keywords, []);
    });
    test('returns defaults for undefined', () => {
        const r = (0, file_splitter_1.parseSplitRules)(undefined);
        assert.strictEqual(r.maxLines, 0);
    });
    test('filters non-string keywords', () => {
        const r = (0, file_splitter_1.parseSplitRules)({ keywords: ['a', 1, null, 'b'] });
        assert.deepStrictEqual(r.keywords, ['a', 'b']);
    });
    test('clamps negative maxLines to 0', () => {
        const r = (0, file_splitter_1.parseSplitRules)({ maxLines: -100 });
        assert.strictEqual(r.maxLines, 0);
    });
    test('accepts valid numbers', () => {
        const r = (0, file_splitter_1.parseSplitRules)({ maxLines: 5000, maxSizeKB: 100, silenceMinutes: 5 });
        assert.strictEqual(r.maxLines, 5000);
        assert.strictEqual(r.maxSizeKB, 100);
        assert.strictEqual(r.silenceMinutes, 5);
    });
});
//# sourceMappingURL=file-splitter.test.js.map