import * as assert from 'assert';
import { fencedBlock, csvFormulaSafe } from '../../../modules/misc/outbound-content-safety';

suite('outbound-content-safety', () => {

    suite('fencedBlock', () => {
        test('uses a plain three-backtick fence for content with no backticks', () => {
            assert.strictEqual(fencedBlock('hello'), '```\nhello\n```');
        });

        test('appends an optional language hint to the opening fence', () => {
            assert.strictEqual(fencedBlock('{}', 'json'), '```json\n{}\n```');
        });

        // The breakout case: a ``` run inside the content must NOT be able to close the fence early.
        test('grows the fence to one more backtick than the longest inner run', () => {
            assert.strictEqual(fencedBlock('before ``` after'), '````\nbefore ``` after\n````');
            assert.strictEqual(fencedBlock('x ```` y'), '`````\nx ```` y\n`````');
        });
    });

    suite('csvFormulaSafe', () => {
        test('prefixes an apostrophe on a formula-trigger lead char', () => {
            assert.strictEqual(csvFormulaSafe('=cmd'), "'=cmd");
            assert.strictEqual(csvFormulaSafe('@x'), "'@x");
            assert.strictEqual(csvFormulaSafe('-cmd'), "'-cmd");
            assert.strictEqual(csvFormulaSafe('\t=x'), "'\t=x");
        });

        test('leaves ordinary text and genuine numbers alone', () => {
            assert.strictEqual(csvFormulaSafe('hello'), 'hello');
            assert.strictEqual(csvFormulaSafe('-5'), '-5');
            assert.strictEqual(csvFormulaSafe('+12.5'), '+12.5');
            assert.strictEqual(csvFormulaSafe(''), '');
        });

        test('treats a formula that merely starts like a number as unsafe', () => {
            // "+1-1" is a formula, not a pure number, so it must be neutralized.
            assert.strictEqual(csvFormulaSafe('+1-1'), "'+1-1");
        });
    });
});
