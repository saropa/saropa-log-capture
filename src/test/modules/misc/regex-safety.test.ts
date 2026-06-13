import * as assert from 'assert';
import { boundForUserRegex, MAX_USER_REGEX_INPUT } from '../../../modules/misc/regex-safety';

suite('regex-safety', () => {

    test('returns short input unchanged (same reference)', () => {
        const s = 'a short log line';
        assert.strictEqual(boundForUserRegex(s), s);
    });

    test('clamps over-long input to the cap so a greedy regex cannot hang on it', () => {
        const long = 'x'.repeat(MAX_USER_REGEX_INPUT + 5000);
        assert.strictEqual(boundForUserRegex(long).length, MAX_USER_REGEX_INPUT);
    });

    test('leaves input exactly at the cap unchanged', () => {
        const exact = 'y'.repeat(MAX_USER_REGEX_INPUT);
        assert.strictEqual(boundForUserRegex(exact).length, MAX_USER_REGEX_INPUT);
    });
});
