import * as assert from 'assert';
import { detectJson, formatJson, jsonPreview, mightContainJson } from '../modules/json-detector';

suite('JsonDetector', () => {

    suite('detectJson', () => {

        test('should detect simple JSON object', () => {
            const result = detectJson('{"key": "value"}');
            assert.strictEqual(result.hasJson, true);
            assert.strictEqual(result.json, '{"key": "value"}');
            assert.deepStrictEqual(result.parsed, { key: 'value' });
        });

        test('should detect JSON with prefix text', () => {
            const result = detectJson('[INFO] {"key": "value"}');
            assert.strictEqual(result.hasJson, true);
            assert.strictEqual(result.prefix, '[INFO] ');
            assert.strictEqual(result.json, '{"key": "value"}');
        });

        test('should detect JSON with suffix text', () => {
            const result = detectJson('{"key": "value"} more text');
            assert.strictEqual(result.hasJson, true);
            assert.strictEqual(result.json, '{"key": "value"}');
            assert.strictEqual(result.suffix, ' more text');
        });

        test('should detect JSON array', () => {
            const result = detectJson('[1, 2, 3]');
            assert.strictEqual(result.hasJson, true);
            assert.deepStrictEqual(result.parsed, [1, 2, 3]);
        });

        test('should detect nested JSON', () => {
            const result = detectJson('{"outer": {"inner": "value"}}');
            assert.strictEqual(result.hasJson, true);
            assert.deepStrictEqual(result.parsed, { outer: { inner: 'value' } });
        });

        test('should return hasJson=false for plain text', () => {
            const result = detectJson('This is plain text');
            assert.strictEqual(result.hasJson, false);
        });

        test('should return hasJson=false for empty string', () => {
            const result = detectJson('');
            assert.strictEqual(result.hasJson, false);
        });

        test('should return hasJson=false for invalid JSON', () => {
            const result = detectJson('{invalid json}');
            assert.strictEqual(result.hasJson, false);
        });

        test('should handle JSON with escaped quotes', () => {
            const result = detectJson('{"msg": "He said \\"hello\\""}');
            assert.strictEqual(result.hasJson, true);
            assert.deepStrictEqual(result.parsed, { msg: 'He said "hello"' });
        });

        test('should not detect primitive values as JSON', () => {
            const result = detectJson('The answer is 42');
            assert.strictEqual(result.hasJson, false);
        });
    });

    suite('formatJson', () => {

        test('should format object with indentation', () => {
            const result = formatJson({ key: 'value' }, 2);
            assert.ok(result.includes('\n'));
            assert.ok(result.includes('  "key"'));
        });

        test('should handle arrays', () => {
            const result = formatJson([1, 2, 3], 2);
            assert.ok(result.includes('1'));
        });
    });

    suite('jsonPreview', () => {

        test('should return full string if short', () => {
            const result = jsonPreview('{"a":1}', 60);
            assert.strictEqual(result, '{"a":1}');
        });

        test('should truncate long strings', () => {
            const long = '{"key": "' + 'a'.repeat(100) + '"}';
            const result = jsonPreview(long, 60);
            assert.ok(result.endsWith('...'));
            assert.strictEqual(result.length, 60);
        });
    });

    suite('mightContainJson', () => {

        test('should return true for text with brace', () => {
            assert.strictEqual(mightContainJson('has { brace'), true);
        });

        test('should return true for text with bracket', () => {
            assert.strictEqual(mightContainJson('has [ bracket'), true);
        });

        test('should return false for plain text', () => {
            assert.strictEqual(mightContainJson('plain text'), false);
        });
    });
});
