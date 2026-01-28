import * as assert from 'assert';
import { parseExclusionPattern, testExclusion, ExclusionRule } from '../modules/exclusion-matcher';

suite('ExclusionMatcher', () => {

    suite('parseExclusionPattern', () => {

        test('should parse a plain string pattern', () => {
            const rule = parseExclusionPattern('debug');
            assert.ok(rule);
            assert.strictEqual(rule.text, 'debug');
            assert.strictEqual(rule.source, 'debug');
            assert.strictEqual(rule.regex, undefined);
        });

        test('should parse a regex pattern', () => {
            const rule = parseExclusionPattern('/error\\d+/i');
            assert.ok(rule);
            assert.ok(rule.regex);
            assert.strictEqual(rule.regex.source, 'error\\d+');
            assert.strictEqual(rule.regex.flags, 'i');
        });

        test('should return undefined for empty string', () => {
            assert.strictEqual(parseExclusionPattern(''), undefined);
            assert.strictEqual(parseExclusionPattern('   '), undefined);
        });

        test('should return undefined for invalid regex', () => {
            assert.strictEqual(parseExclusionPattern('/[invalid/'), undefined);
        });

        test('should treat single slash as plain text', () => {
            const rule = parseExclusionPattern('/');
            assert.ok(rule);
            assert.strictEqual(rule.text, '/');
        });

        test('should trim whitespace from pattern', () => {
            const rule = parseExclusionPattern('  warn  ');
            assert.ok(rule);
            assert.strictEqual(rule.text, 'warn');
        });
    });

    suite('testExclusion', () => {

        test('should match case-insensitively for string patterns', () => {
            const rules: ExclusionRule[] = [{ source: 'error', text: 'error' }];
            assert.strictEqual(testExclusion('An ERROR occurred', rules), true);
            assert.strictEqual(testExclusion('An Error occurred', rules), true);
            assert.strictEqual(testExclusion('All good', rules), false);
        });

        test('should match regex patterns', () => {
            const rules: ExclusionRule[] = [{ source: '/warn\\d+/', regex: /warn\d+/ }];
            assert.strictEqual(testExclusion('warn123 detected', rules), true);
            assert.strictEqual(testExclusion('warning text', rules), false);
        });

        test('should return false for empty rules', () => {
            assert.strictEqual(testExclusion('anything', []), false);
        });

        test('should match if any rule matches', () => {
            const rules: ExclusionRule[] = [
                { source: 'error', text: 'error' },
                { source: 'debug', text: 'debug' },
            ];
            assert.strictEqual(testExclusion('debug info', rules), true);
            assert.strictEqual(testExclusion('error info', rules), true);
            assert.strictEqual(testExclusion('warning info', rules), false);
        });

        test('should handle special characters in plain text', () => {
            const rules: ExclusionRule[] = [{ source: '[foo]', text: '[foo]' }];
            assert.strictEqual(testExclusion('value is [foo] bar', rules), true);
            assert.strictEqual(testExclusion('value is foo bar', rules), false);
        });
    });
});
