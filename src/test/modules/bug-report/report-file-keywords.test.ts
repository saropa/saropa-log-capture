import * as assert from 'assert';
import { extractKeywords } from '../../../modules/bug-report/report-file-keywords';

suite('ReportFileKeywords', () => {

    suite('extractKeywords', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual(extractKeywords(''), []);
        });

        test('should extract severity words', () => {
            const result = extractKeywords('There was a fatal error in the system');
            assert.ok(result.includes('error'));
            assert.ok(result.includes('fatal'));
        });

        test('should extract crash-related severity', () => {
            const result = extractKeywords('Application crash with null pointer');
            assert.ok(result.includes('crash'));
            assert.ok(result.includes('null'));
        });

        test('should extract repeated words', () => {
            const result = extractKeywords('connection timeout and another connection timeout again');
            assert.ok(result.includes('timeout'));
            assert.ok(result.includes('connection'));
        });

        test('should not extract stop words', () => {
            const result = extractKeywords('the the the and and and');
            assert.deepStrictEqual(result, []);
        });

        test('should extract camelCase identifiers', () => {
            const result = extractKeywords('NullPointerException was thrown');
            assert.ok(result.some(k => k.includes('nullpointer')));
        });

        test('should extract file name identifiers', () => {
            const result = extractKeywords('Error in session-manager.ts at line 42');
            assert.ok(result.some(k => k.includes('session-manager')));
        });

        test('should respect max parameter', () => {
            const text = 'error fatal crash timeout null overflow denied failed failure panic';
            const result = extractKeywords(text, 2);
            assert.ok(result.length <= 2);
        });

        test('should default to max 3 keywords', () => {
            const text = 'error fatal crash timeout null overflow denied';
            const result = extractKeywords(text);
            assert.ok(result.length <= 3);
        });

        test('should deduplicate keywords', () => {
            const result = extractKeywords('error error error error');
            const unique = new Set(result);
            assert.strictEqual(result.length, unique.size);
        });

        test('should sanitize keywords for filenames', () => {
            const result = extractKeywords('crash! in @special chars');
            for (const kw of result) {
                assert.ok(/^[a-z0-9-]+$/.test(kw), `"${kw}" should be filename-safe`);
            }
        });

        test('should truncate long keywords to 20 chars', () => {
            // Feed a very long camelCase identifier
            const longId = 'VeryLongClassNameThatExceedsTwentyCharacters';
            const result = extractKeywords(longId);
            for (const kw of result) {
                assert.ok(kw.length <= 20, `"${kw}" should be ≤20 chars`);
            }
        });

        test('should handle mixed severity and identifiers', () => {
            const text = 'NullPointerException: crash at UserService.login';
            const result = extractKeywords(text, 5);
            assert.ok(result.length > 0);
            assert.ok(result.includes('crash') || result.includes('null'));
        });
    });
});
