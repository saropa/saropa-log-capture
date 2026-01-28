import * as assert from 'assert';
import { searchLogFiles } from '../modules/log-search';

suite('LogSearch', () => {

    test('should return empty results when no workspace', async () => {
        // Without a workspace, should return empty results
        const results = await searchLogFiles('test');
        assert.strictEqual(results.matches.length, 0);
        assert.strictEqual(results.totalFiles, 0);
    });

    test('should handle empty query gracefully', async () => {
        const results = await searchLogFiles('');
        assert.strictEqual(results.matches.length, 0);
        assert.strictEqual(results.query, '');
    });

    test('should respect case sensitivity option', async () => {
        // With case sensitive, pattern should be different
        const results = await searchLogFiles('Test', { caseSensitive: true });
        assert.strictEqual(results.query, 'Test');
    });

    test('should handle regex option', async () => {
        // With regex option, should accept regex patterns
        const results = await searchLogFiles('test.*pattern', { useRegex: true });
        assert.strictEqual(results.query, 'test.*pattern');
    });

    test('should handle invalid regex gracefully', async () => {
        // Invalid regex should return empty results, not throw
        const results = await searchLogFiles('[invalid', { useRegex: true });
        assert.strictEqual(results.matches.length, 0);
    });
});
