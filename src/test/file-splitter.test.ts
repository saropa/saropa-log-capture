import * as assert from 'assert';
import { FileSplitter, SplitRules, defaultSplitRules, formatSplitReason } from '../modules/file-splitter';

suite('FileSplitter', () => {

    test('should return default rules with all values disabled', () => {
        const defaults = defaultSplitRules();
        assert.strictEqual(defaults.maxLines, 0);
        assert.strictEqual(defaults.maxSizeKB, 0);
        assert.strictEqual(defaults.keywords.length, 0);
        assert.strictEqual(defaults.maxDurationMinutes, 0);
        assert.strictEqual(defaults.silenceMinutes, 0);
    });

    test('should not trigger split when no rules are active', () => {
        const splitter = new FileSplitter(defaultSplitRules());
        const result = splitter.evaluate({
            lineCount: 10000,
            bytesWritten: 1000000,
            startTime: Date.now() - 3600000,
            lastLineTime: Date.now() - 600000,
        });
        assert.strictEqual(result.shouldSplit, false);
    });

    test('should trigger split when line count exceeds maxLines', () => {
        const rules: SplitRules = { ...defaultSplitRules(), maxLines: 100 };
        const splitter = new FileSplitter(rules);
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
        const rules: SplitRules = { ...defaultSplitRules(), maxSizeKB: 100 };
        const splitter = new FileSplitter(rules);
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
        const rules: SplitRules = { ...defaultSplitRules(), keywords: ['HOT RESTART'] };
        const splitter = new FileSplitter(rules);
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
        const rules: SplitRules = { ...defaultSplitRules(), keywords: ['/restart/i'] };
        const splitter = new FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 10,
            bytesWritten: 1000,
            startTime: Date.now(),
            lastLineTime: Date.now(),
        }, 'Performing RESTART operation');
        assert.strictEqual(result.shouldSplit, true);
    });

    test('should not split when below thresholds', () => {
        const rules: SplitRules = { ...defaultSplitRules(), maxLines: 100, maxSizeKB: 100 };
        const splitter = new FileSplitter(rules);
        const result = splitter.evaluate({
            lineCount: 50,
            bytesWritten: 10000,
            startTime: Date.now(),
            lastLineTime: Date.now(),
        });
        assert.strictEqual(result.shouldSplit, false);
    });

    test('hasActiveRules should return false for default rules', () => {
        const splitter = new FileSplitter(defaultSplitRules());
        assert.strictEqual(splitter.hasActiveRules(), false);
    });

    test('hasActiveRules should return true when any rule is set', () => {
        const rules: SplitRules = { ...defaultSplitRules(), maxLines: 1000 };
        const splitter = new FileSplitter(rules);
        assert.strictEqual(splitter.hasActiveRules(), true);
    });
});

suite('formatSplitReason', () => {

    test('should format lines reason', () => {
        const result = formatSplitReason({ type: 'lines', count: 1000 });
        assert.ok(result.includes('1000'));
        assert.ok(result.includes('lines'));
    });

    test('should format size reason', () => {
        const result = formatSplitReason({ type: 'size', sizeKB: 500 });
        assert.ok(result.includes('500'));
        assert.ok(result.includes('KB'));
    });

    test('should format keyword reason', () => {
        const result = formatSplitReason({ type: 'keyword', keyword: 'HOT RESTART' });
        assert.ok(result.includes('HOT RESTART'));
    });

    test('should format manual reason', () => {
        const result = formatSplitReason({ type: 'manual' });
        assert.ok(result.includes('manual'));
    });
});
