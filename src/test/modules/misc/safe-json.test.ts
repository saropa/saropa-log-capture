import * as assert from 'assert';
import { safeParseJSON, parseJSONOrDefault } from '../../../modules/misc/safe-json';

suite('safe-json', () => {

  suite('safeParseJSON', () => {
    test('parses valid JSON string', () => {
      const result = safeParseJSON<{ a: number }>('{"a":1}');
      assert.strictEqual(result?.a, 1);
    });
    test('parses valid JSON Buffer', () => {
      const result = safeParseJSON<{ x: string }>(Buffer.from('{"x":"y"}', 'utf-8'));
      assert.strictEqual(result?.x, 'y');
    });
    test('returns undefined for invalid JSON', () => {
      assert.strictEqual(safeParseJSON('{ invalid'), undefined);
      assert.strictEqual(safeParseJSON(''), undefined);
    });
    test('returns fallback when parse fails', () => {
      const fallback = { default: true };
      assert.strictEqual(safeParseJSON('{', fallback), fallback);
    });
    test('returns undefined for empty string when no fallback', () => {
      const result = safeParseJSON('   ');
      assert.strictEqual(result, undefined);
    });
    test('returns fallback for empty string when fallback provided', () => {
      const fallback = {};
      assert.strictEqual(safeParseJSON('   ', fallback), fallback);
    });
  });

  suite('parseJSONOrDefault', () => {
    test('returns parsed object when valid', () => {
      const def = { k: 'default' };
      const result = parseJSONOrDefault<{ k: string }>('{"k":"v"}', def);
      assert.strictEqual(result.k, 'v');
    });
    test('returns default when parse fails', () => {
      const def = { k: 'default' };
      assert.strictEqual(parseJSONOrDefault('not json', def), def);
    });
    test('returns default when result is null', () => {
      const def = { k: 'default' };
      assert.strictEqual(parseJSONOrDefault('null', def), def);
    });
  });
});
