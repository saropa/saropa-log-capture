import * as assert from 'node:assert';
import test from 'node:test';
import {
  CRASH_SIGNATURE_RULE_PREFIX,
  crashSignatureRuleId,
  deriveCrashSignature,
} from '../../../modules/diagnostics/crash-signature';

test('deriveCrashSignature recognizes StateError no-element from `.first` on empty', () => {
  assert.strictEqual(deriveCrashSignature('Unhandled exception: Bad state: No element'), 'state-error-no-element');
});

test('deriveCrashSignature recognizes RangeError index', () => {
  assert.strictEqual(
    deriveCrashSignature('RangeError (index): Invalid value: Not in inclusive range 0..2: 3'),
    'range-error-index',
  );
});

test('deriveCrashSignature recognizes the null check (bang) operator', () => {
  assert.strictEqual(deriveCrashSignature('Null check operator used on a null value'), 'null-check-operator');
});

test('deriveCrashSignature recognizes LateInitializationError', () => {
  assert.strictEqual(
    deriveCrashSignature("LateInitializationError: Field 'db' has not been initialized."),
    'late-init',
  );
});

test('deriveCrashSignature recognizes concurrent modification', () => {
  assert.strictEqual(
    deriveCrashSignature('Concurrent modification during iteration: Instance(length:3) of _GrowableList.'),
    'concurrent-modification',
  );
});

test('deriveCrashSignature recognizes a failed cast (type error)', () => {
  assert.strictEqual(
    deriveCrashSignature("type 'String' is not a subtype of type 'int' in type cast"),
    'type-error-cast',
  );
});

test('deriveCrashSignature recognizes FormatException', () => {
  assert.strictEqual(deriveCrashSignature('FormatException: Invalid radix-10 number'), 'format-exception');
});

test('deriveCrashSignature recognizes ANR text', () => {
  assert.strictEqual(deriveCrashSignature('ANR in com.example (Input dispatching timed out)'), 'anr');
});

test('deriveCrashSignature recognizes OutOfMemory', () => {
  assert.strictEqual(deriveCrashSignature('java.lang.OutOfMemoryError: Failed to allocate'), 'out-of-memory');
});

test('deriveCrashSignature returns undefined for benign text', () => {
  assert.strictEqual(deriveCrashSignature('Connected to device successfully'), undefined);
});

test('deriveCrashSignature returns undefined for empty/undefined input', () => {
  assert.strictEqual(deriveCrashSignature(undefined), undefined);
  assert.strictEqual(deriveCrashSignature(''), undefined);
});

test('crashSignatureRuleId namespaces with the crash prefix', () => {
  assert.strictEqual(crashSignatureRuleId('range-error-index'), `${CRASH_SIGNATURE_RULE_PREFIX}range-error-index`);
  assert.strictEqual(crashSignatureRuleId('range-error-index'), 'crash:range-error-index');
});
