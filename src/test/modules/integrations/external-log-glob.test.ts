import * as assert from 'assert';
import { isGlobPattern, globToRegExp, pickLatestMatch } from '../../../modules/integrations/external-log-glob';

suite('external-log-glob', () => {
    suite('isGlobPattern', () => {
        test('should detect wildcards in the final segment', () => {
            assert.strictEqual(isGlobPattern('logs/*.log'), true);
            assert.strictEqual(isGlobPattern('logs/app-?.log'), true);
        });

        test('should treat a plain path as non-glob', () => {
            assert.strictEqual(isGlobPattern('logs/app.log'), false);
            assert.strictEqual(isGlobPattern('app.log'), false);
        });
    });

    suite('globToRegExp', () => {
        test('should match files via * and ? wildcards', () => {
            const re = globToRegExp('app-*.log');
            assert.ok(re.test('app-2026.log'));
            assert.ok(!re.test('other.log'));
        });

        test('should anchor and escape literal dots', () => {
            const re = globToRegExp('*.log');
            assert.ok(re.test('a.log'));
            assert.ok(!re.test('a.log.1'));
        });
    });

    suite('pickLatestMatch', () => {
        const candidates = [
            { name: 'app.log.1', mtimeMs: 100 },
            { name: 'app.log', mtimeMs: 300 },
            { name: 'app.log.2', mtimeMs: 200 },
            { name: 'other.txt', mtimeMs: 999 },
        ];

        test('should pick the most recently modified match', () => {
            assert.strictEqual(pickLatestMatch(candidates, '*.log'), 'app.log');
        });

        test('should ignore non-matching files even if newer', () => {
            assert.strictEqual(pickLatestMatch(candidates, 'app.log.?'), 'app.log.2');
        });

        test('should return undefined when nothing matches', () => {
            assert.strictEqual(pickLatestMatch(candidates, 'nginx*.log'), undefined);
        });
    });
});
