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
      /* stderrTreatAsError=false: "failed" matches warnPattern (warning), not error.
         First true error is line 2 ("error:" matches looseErrorPattern). */
      const result = findFirstErrorLines(lines, { strict: false, includeWarning: false, stderrTreatAsError: false });
      assert.ok(result.firstError);
      assert.strictEqual(result.firstError!.lineIndex, 2);
      assert.strictEqual(result.firstError!.level, 'error');
      assert.ok(result.firstError!.snippet.includes('error') || result.firstError!.lineText.includes('error'));
    });

    test('returns stderr as error when stderrTreatAsError is true', () => {
      const lines = [
        '[12:00:00] [stdout] Info message',
        '[12:00:01] [stderr] Something failed',
        '[12:00:02] [stdout] Another error: null',
      ];
      const result = findFirstErrorLines(lines, { strict: false, includeWarning: false, stderrTreatAsError: true });
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

    test('skips errors before skipBeforeLine and counts them', () => {
      const lines = [
        '[12:00:00] [stderr] E/AndroidRuntime: FATAL EXCEPTION',
        '[12:00:01] [stderr] E/AndroidRuntime: PID: 24445',
        '[12:00:02] [stdout] Launching lib/main.dart in debug mode',
        '[12:00:03] [stdout] Error: real app error',
      ];
      const result = findFirstErrorLines(lines, {
        strict: false, includeWarning: false, stderrTreatAsError: true, skipBeforeLine: 2,
      });
      assert.ok(result.firstError);
      assert.strictEqual(result.firstError!.lineIndex, 3);
      assert.strictEqual(result.skippedPreLaunchErrors, 2);
    });

    test('returns errors from line 0 when skipBeforeLine is 0 or undefined', () => {
      const lines = [
        '[12:00:00] [stdout] Error: early error',
        '[12:00:01] [stdout] Normal line',
      ];
      const noSkip = findFirstErrorLines(lines, {
        strict: false, includeWarning: false, stderrTreatAsError: false,
      });
      assert.ok(noSkip.firstError);
      assert.strictEqual(noSkip.firstError!.lineIndex, 0);
      assert.strictEqual(noSkip.skippedPreLaunchErrors, 0);
      const skipZero = findFirstErrorLines(lines, {
        strict: false, includeWarning: false, stderrTreatAsError: false, skipBeforeLine: 0,
      });
      assert.ok(skipZero.firstError);
      assert.strictEqual(skipZero.firstError!.lineIndex, 0);
      assert.strictEqual(skipZero.skippedPreLaunchErrors, 0);
    });

    test('returns empty when all errors are before skipBeforeLine', () => {
      const lines = [
        '[12:00:00] [stderr] E/AndroidRuntime: FATAL EXCEPTION',
        '[12:00:01] [stdout] Normal after launch',
      ];
      const result = findFirstErrorLines(lines, {
        strict: false, includeWarning: false, stderrTreatAsError: true, skipBeforeLine: 1,
      });
      assert.ok(!result.firstError);
      assert.strictEqual(result.skippedPreLaunchErrors, 1);
    });
  });
});
