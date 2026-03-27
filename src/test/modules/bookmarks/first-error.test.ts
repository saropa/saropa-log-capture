/**
 * Tests for first-error detection (smart bookmarks).
 */

import * as assert from 'assert';
import { findFirstErrorLines } from '../../../modules/bookmarks/first-error';

suite('FirstError', () => {
  suite('findFirstErrorLines', () => {
    test('returns first error line index and snippet', () => {
      const lines = [
        '[12:00:00] [stdout] Info message',
        '[12:00:01] [stderr] Something failed',
        '[12:00:02] [stdout] Another error: null',
      ];
      const result = findFirstErrorLines(lines, { strict: false, includeWarning: false, stderrTreatAsError: false });
      assert.ok(result.firstError);
      assert.strictEqual(result.firstError!.lineIndex, 1);
      assert.strictEqual(result.firstError!.level, 'error');
      assert.ok(result.firstError!.snippet.includes('failed') || result.firstError!.lineText.includes('failed'));
    });

    test('uses content line format [time] [category] rest', () => {
      const lines = [
        '[12:00:00.123] [console] Normal output',
        '[12:00:01.456] [stdout] Error: connection refused',
      ];
      const result = findFirstErrorLines(lines, { strict: true, includeWarning: false, stderrTreatAsError: false });
      assert.ok(result.firstError);
      assert.strictEqual(result.firstError!.lineIndex, 1);
      assert.strictEqual(result.firstError!.level, 'error');
    });

    test('returns first warning when includeWarning true and no error', () => {
      const lines = [
        '[12:00:00] [stdout] Info',
        '[12:00:01] [stdout] Warning: deprecated API',
      ];
      const result = findFirstErrorLines(lines, { strict: false, includeWarning: true, stderrTreatAsError: false });
      assert.ok(!result.firstError);
      assert.ok(result.firstWarning);
      assert.strictEqual(result.firstWarning!.lineIndex, 1);
      assert.strictEqual(result.firstWarning!.level, 'warning');
    });

    test('returns empty when no error or warning', () => {
      const lines = [
        '[12:00:00] [stdout] Just info',
        '[12:00:01] [console] Debug trace',
      ];
      const result = findFirstErrorLines(lines, { strict: true, includeWarning: true, stderrTreatAsError: false });
      assert.ok(!result.firstError);
      assert.ok(!result.firstWarning);
    });

    test('skips marker lines', () => {
      const lines = [
        '--- MARKER: test ---',
        '[12:00:00] [stdout] Error: real error',
      ];
      const result = findFirstErrorLines(lines, { strict: false, includeWarning: false, stderrTreatAsError: false });
      assert.ok(result.firstError);
      assert.strictEqual(result.firstError!.lineIndex, 1);
    });
  });
});
