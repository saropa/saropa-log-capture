import * as assert from 'assert';
import { AutoTagger, parseAutoTagPattern } from '../modules/auto-tagger';

suite('AutoTagger', () => {

    suite('parseAutoTagPattern', () => {
        test('should parse plain string as case-insensitive regex', () => {
            const regex = parseAutoTagPattern('BUILD FAILED');
            assert.ok(regex.test('BUILD FAILED'));
            assert.ok(regex.test('build failed'));
            assert.ok(regex.test('Error: BUILD FAILED at line 10'));
        });

        test('should parse regex pattern with flags', () => {
            const regex = parseAutoTagPattern('/Error.*null/i');
            assert.ok(regex.test('Error: null pointer'));
            assert.ok(regex.test('ERROR: NULL value'));
            assert.ok(!regex.test('This is fine'));
        });

        test('should escape special regex characters in plain strings', () => {
            const regex = parseAutoTagPattern('[ERROR]');
            assert.ok(regex.test('[ERROR] Something went wrong'));
            assert.ok(!regex.test('ERROR Something went wrong'));
        });
    });

    suite('AutoTagger class', () => {
        test('should match simple string patterns', () => {
            const tagger = new AutoTagger([
                { pattern: 'BUILD FAILED', tag: 'build-fail' },
            ]);

            const matches = tagger.processLine('Error: BUILD FAILED at step 3');
            assert.deepStrictEqual(matches, ['build-fail']);
        });

        test('should match regex patterns', () => {
            const tagger = new AutoTagger([
                { pattern: '/Exception.*null/i', tag: 'npe' },
            ]);

            const matches = tagger.processLine('NullPointerException: null value');
            assert.deepStrictEqual(matches, ['npe']);
        });

        test('should only trigger each tag once per session', () => {
            const tagger = new AutoTagger([
                { pattern: 'error', tag: 'has-errors' },
            ]);

            const first = tagger.processLine('First error');
            assert.deepStrictEqual(first, ['has-errors']);

            const second = tagger.processLine('Second error');
            assert.deepStrictEqual(second, []);
        });

        test('should match multiple patterns on same line', () => {
            const tagger = new AutoTagger([
                { pattern: 'error', tag: 'has-errors' },
                { pattern: 'fatal', tag: 'has-fatal' },
            ]);

            const matches = tagger.processLine('Fatal error occurred');
            assert.ok(matches.includes('has-errors'));
            assert.ok(matches.includes('has-fatal'));
        });

        test('should return triggered tags sorted', () => {
            const tagger = new AutoTagger([
                { pattern: 'zebra', tag: 'z-tag' },
                { pattern: 'apple', tag: 'a-tag' },
            ]);

            tagger.processLine('zebra');
            tagger.processLine('apple');

            const tags = tagger.getTriggeredTags();
            assert.deepStrictEqual(tags, ['a-tag', 'z-tag']);
        });

        test('should reset triggered tags', () => {
            const tagger = new AutoTagger([
                { pattern: 'error', tag: 'has-errors' },
            ]);

            tagger.processLine('error');
            assert.ok(tagger.hasTriggeredTags());

            tagger.reset();
            assert.ok(!tagger.hasTriggeredTags());
            assert.deepStrictEqual(tagger.getTriggeredTags(), []);
        });

        test('should handle empty rules', () => {
            const tagger = new AutoTagger([]);
            const matches = tagger.processLine('any text');
            assert.deepStrictEqual(matches, []);
        });

        test('should skip invalid regex patterns', () => {
            const tagger = new AutoTagger([
                { pattern: '/[invalid/', tag: 'invalid' },
                { pattern: 'valid', tag: 'valid' },
            ]);

            const matches = tagger.processLine('valid text');
            assert.deepStrictEqual(matches, ['valid']);
        });

        test('should skip rules with empty pattern or tag', () => {
            const tagger = new AutoTagger([
                { pattern: '', tag: 'empty-pattern' },
                { pattern: 'valid', tag: '' },
                { pattern: 'also-valid', tag: 'valid-tag' },
            ]);

            const matches = tagger.processLine('valid also-valid text');
            assert.deepStrictEqual(matches, ['valid-tag']);
        });
    });
});
