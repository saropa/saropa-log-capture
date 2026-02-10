import * as assert from 'assert';
import {
    HighlightRule,
    parseHighlightPattern,
    compileHighlightRules,
    matchHighlightRules,
    stylesToCss,
    HighlightRulesManager,
} from '../modules/highlight-rules';

suite('HighlightRules', () => {

    suite('parseHighlightPattern', () => {
        test('should return undefined for empty pattern', () => {
            assert.strictEqual(parseHighlightPattern(''), undefined);
        });

        test('should parse plain string as case-insensitive regex', () => {
            const regex = parseHighlightPattern('error');
            assert.ok(regex);
            assert.ok(regex.test('Error occurred'));
            assert.ok(regex.test('ERROR'));
            assert.ok(regex.test('This has error in it'));
            assert.ok(!regex.test('no match here'));
        });

        test('should escape special regex characters in plain strings', () => {
            const regex = parseHighlightPattern('[ERROR]');
            assert.ok(regex);
            assert.ok(regex.test('[ERROR] Something went wrong'));
            assert.ok(!regex.test('ERROR Something went wrong'));
        });

        test('should parse regex pattern with flags', () => {
            const regex = parseHighlightPattern('/Error.*null/i');
            assert.ok(regex);
            assert.ok(regex.test('Error: null pointer'));
            assert.ok(regex.test('ERROR: NULL value'));
            assert.ok(!regex.test('This is fine'));
        });

        test('should parse regex without flags', () => {
            const regex = parseHighlightPattern('/Error/');
            assert.ok(regex);
            assert.ok(regex.test('Error here'));
            assert.ok(!regex.test('error here')); // Case-sensitive
        });

        test('should return undefined for invalid regex', () => {
            const regex = parseHighlightPattern('/[invalid/');
            assert.strictEqual(regex, undefined);
        });
    });

    suite('compileHighlightRules', () => {
        test('should compile valid rules', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red' },
                { pattern: '/warning/i', color: 'yellow' },
            ];
            const compiled = compileHighlightRules(rules);
            assert.strictEqual(compiled.length, 2);
        });

        test('should skip rules without pattern', () => {
            const rules: HighlightRule[] = [
                { pattern: '', color: 'red' },
                { pattern: 'valid', color: 'blue' },
            ];
            const compiled = compileHighlightRules(rules);
            assert.strictEqual(compiled.length, 1);
        });

        test('should skip rules without any styling', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error' }, // No color, backgroundColor, bold, or italic
                { pattern: 'valid', color: 'blue' },
            ];
            const compiled = compileHighlightRules(rules);
            assert.strictEqual(compiled.length, 1);
        });

        test('should skip rules with invalid regex', () => {
            const rules: HighlightRule[] = [
                { pattern: '/[invalid/', color: 'red' },
                { pattern: 'valid', color: 'blue' },
            ];
            const compiled = compileHighlightRules(rules);
            assert.strictEqual(compiled.length, 1);
        });

        test('should use pattern as label when label not provided', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red' },
            ];
            const compiled = compileHighlightRules(rules);
            assert.strictEqual(compiled[0].label, 'error');
        });

        test('should use provided label', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red', label: 'Error Level' },
            ];
            const compiled = compileHighlightRules(rules);
            assert.strictEqual(compiled[0].label, 'Error Level');
        });
    });

    suite('matchHighlightRules', () => {
        test('should return undefined for empty rules', () => {
            const match = matchHighlightRules('any text', []);
            assert.strictEqual(match, undefined);
        });

        test('should match simple pattern', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red' },
            ];
            const compiled = compileHighlightRules(rules);
            const match = matchHighlightRules('Error occurred', compiled);
            assert.ok(match);
            assert.strictEqual(match.styles.color, 'red');
            assert.deepStrictEqual(match.matchedLabels, ['error']);
        });

        test('should match multiple patterns', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red' },
                { pattern: 'fatal', backgroundColor: 'darkred' },
            ];
            const compiled = compileHighlightRules(rules);
            const match = matchHighlightRules('Fatal error occurred', compiled);
            assert.ok(match);
            assert.strictEqual(match.styles.color, 'red');
            assert.strictEqual(match.styles.backgroundColor, 'darkred');
            assert.ok(match.matchedLabels.includes('error'));
            assert.ok(match.matchedLabels.includes('fatal'));
        });

        test('should use first match for conflicting styles', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red' },
                { pattern: 'fatal', color: 'darkred' }, // Different color
            ];
            const compiled = compileHighlightRules(rules);
            const match = matchHighlightRules('Fatal error', compiled);
            assert.ok(match);
            // First matching rule (error) wins for color
            assert.strictEqual(match.styles.color, 'red');
        });

        test('should return undefined when no rules match', () => {
            const rules: HighlightRule[] = [
                { pattern: 'error', color: 'red' },
            ];
            const compiled = compileHighlightRules(rules);
            const match = matchHighlightRules('All is well', compiled);
            assert.strictEqual(match, undefined);
        });

        test('should apply bold and italic styles', () => {
            const rules: HighlightRule[] = [
                { pattern: 'important', bold: true, italic: true, color: 'blue' },
            ];
            const compiled = compileHighlightRules(rules);
            const match = matchHighlightRules('This is important', compiled);
            assert.ok(match);
            assert.strictEqual(match.styles.fontWeight, 'bold');
            assert.strictEqual(match.styles.fontStyle, 'italic');
        });
    });

    suite('stylesToCss', () => {
        test('should return empty string for empty styles', () => {
            const css = stylesToCss({});
            assert.strictEqual(css, '');
        });

        test('should generate CSS for color', () => {
            const css = stylesToCss({ color: 'red' });
            assert.strictEqual(css, 'color: red;');
        });

        test('should generate CSS for multiple properties', () => {
            const css = stylesToCss({
                color: 'red',
                backgroundColor: 'yellow',
                fontWeight: 'bold',
                fontStyle: 'italic',
            });
            assert.ok(css.includes('color: red'));
            assert.ok(css.includes('background-color: yellow'));
            assert.ok(css.includes('font-weight: bold'));
            assert.ok(css.includes('font-style: italic'));
        });
    });

    suite('HighlightRulesManager', () => {
        test('should start with no rules', () => {
            const manager = new HighlightRulesManager();
            assert.strictEqual(manager.ruleCount, 0);
            assert.strictEqual(manager.hasRules(), false);
        });

        test('should set and match rules', () => {
            const manager = new HighlightRulesManager();
            manager.setRules([
                { pattern: 'error', color: 'red' },
            ]);
            assert.strictEqual(manager.ruleCount, 1);
            assert.strictEqual(manager.hasRules(), true);

            const match = manager.matchLine('Error occurred');
            assert.ok(match);
            assert.strictEqual(match.styles.color, 'red');
        });

        test('should return undefined when line does not match', () => {
            const manager = new HighlightRulesManager();
            manager.setRules([
                { pattern: 'error', color: 'red' },
            ]);
            const match = manager.matchLine('All is well');
            assert.strictEqual(match, undefined);
        });

        test('should update rules when setRules is called again', () => {
            const manager = new HighlightRulesManager();
            manager.setRules([
                { pattern: 'error', color: 'red' },
            ]);
            assert.strictEqual(manager.ruleCount, 1);

            manager.setRules([
                { pattern: 'warn', color: 'yellow' },
                { pattern: 'info', color: 'blue' },
            ]);
            assert.strictEqual(manager.ruleCount, 2);

            // Old rule should not match
            assert.strictEqual(manager.matchLine('Error'), undefined);
            // New rules should match
            assert.ok(manager.matchLine('Warning'));
            assert.ok(manager.matchLine('Info'));
        });
    });
});
