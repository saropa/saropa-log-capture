import * as assert from 'assert';
import {
  clamp,
  ensureBoolean,
  ensureEnum,
  ensureNonNegative,
  ensureStringArray,
  ensureNonEmptyString,
  MAX_SAFE_LINE,
  MAX_SESSION_FILENAME_LENGTH,
} from '../../../modules/config/config-validation';

suite('Config validation', () => {

  suite('clamp', () => {
    test('returns value when within range', () => {
      assert.strictEqual(clamp(50, 0, 100, 10), 50);
    });
    test('returns min when value below range', () => {
      assert.strictEqual(clamp(-5, 0, 100, 10), 0);
    });
    test('returns max when value above range', () => {
      assert.strictEqual(clamp(150, 0, 100, 10), 100);
    });
    test('returns default for NaN', () => {
      assert.strictEqual(clamp(NaN, 0, 100, 10), 10);
    });
    test('returns default for non-number', () => {
      assert.strictEqual(clamp('50' as unknown, 0, 100, 10), 10);
      assert.strictEqual(clamp(undefined, 0, 100, 10), 10);
      assert.strictEqual(clamp(null, 0, 100, 10), 10);
    });
    test('returns default for Infinity', () => {
      assert.strictEqual(clamp(Infinity, 0, 100, 10), 10);
    });
  });

  suite('ensureNonNegative', () => {
    test('returns value when >= 0', () => {
      assert.strictEqual(ensureNonNegative(0, 5), 0);
      assert.strictEqual(ensureNonNegative(100, 5), 100);
    });
    test('returns default for negative', () => {
      assert.strictEqual(ensureNonNegative(-1, 5), 5);
    });
    test('returns default for non-number', () => {
      assert.strictEqual(ensureNonNegative('0' as unknown, 5), 5);
    });
  });

  suite('ensureStringArray', () => {
    test('returns array of strings filtering invalid elements', () => {
      const result = ensureStringArray(['a', 1, 'b', null, 'c', undefined], []);
      assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });
    test('returns fallback when not array', () => {
      const fallback = ['x'];
      assert.strictEqual(ensureStringArray(null, fallback), fallback);
      assert.strictEqual(ensureStringArray(undefined, fallback), fallback);
      assert.strictEqual(ensureStringArray('hello', fallback), fallback);
      assert.strictEqual(ensureStringArray(42, fallback), fallback);
    });
    test('returns empty array when array is empty', () => {
      assert.deepStrictEqual(ensureStringArray([], ['default']), []);
    });
  });

  suite('ensureEnum', () => {
    test('returns value when in allowed set', () => {
      assert.strictEqual(ensureEnum('a', ['a', 'b'], 'c'), 'a');
      assert.strictEqual(ensureEnum('b', ['a', 'b'], 'c'), 'b');
    });
    test('returns default when not in allowed set', () => {
      assert.strictEqual(ensureEnum('d', ['a', 'b'], 'c'), 'c');
    });
    test('returns default when not string', () => {
      assert.strictEqual(ensureEnum(1, ['a', 'b'], 'c'), 'c');
      assert.strictEqual(ensureEnum(null, ['a', 'b'], 'c'), 'c');
    });
  });

  suite('ensureBoolean', () => {
    test('returns value when boolean', () => {
      assert.strictEqual(ensureBoolean(true, false), true);
      assert.strictEqual(ensureBoolean(false, true), false);
    });
    test('returns default when not boolean', () => {
      assert.strictEqual(ensureBoolean(1, false), false);
      assert.strictEqual(ensureBoolean('true', true), true);
    });
  });

  suite('ensureNonEmptyString', () => {
    test('returns trimmed string when non-empty', () => {
      assert.strictEqual(ensureNonEmptyString('  foo  ', 'def'), 'foo');
    });
    test('returns default when empty or whitespace', () => {
      assert.strictEqual(ensureNonEmptyString('', 'def'), 'def');
      assert.strictEqual(ensureNonEmptyString('   ', 'def'), 'def');
    });
    test('returns default when not string', () => {
      assert.strictEqual(ensureNonEmptyString(123 as unknown, 'def'), 'def');
    });
  });

  suite('constants', () => {
    test('MAX_SAFE_LINE is positive and reasonable', () => {
      assert.ok(MAX_SAFE_LINE >= 1 && MAX_SAFE_LINE <= 50_000_000);
    });
    test('MAX_SESSION_FILENAME_LENGTH is positive', () => {
      assert.ok(MAX_SESSION_FILENAME_LENGTH >= 256);
    });
  });
});
