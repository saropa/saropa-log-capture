import * as assert from 'node:assert';
import { locateLine } from '../../ui/shared/handlers/trouble-detail-handler';

/**
 * Trouble Mode detail pane (Stage 4) — line location.
 *
 * `locateLine` maps a selected feed row back to a file line. `sourceLineNo` is only
 * a HINT (it can be absent for live capture and carries a post-header offset), so the
 * contract is: trust the hint only when that file line actually contains the posted
 * text; otherwise search for the text; degrade to the hint or -1. Getting this wrong
 * would show the WRONG surrounding context in the pane.
 */
suite('Trouble Mode detail — locateLine', () => {
  const lines = ['=== SESSION START ===', 'Date: 2026-07-09', 'nominal chatter', 'ERROR connection refused', 'more chatter'];

  test('trusts the hint when that line contains the text', () => {
    // sourceLineNo is 1-based → hint index 3 = the ERROR line.
    assert.strictEqual(locateLine(lines, 4, 'ERROR connection refused'), 3);
  });

  test('falls back to text search when the hint is skewed by the header offset', () => {
    // Hint says line 1 (index 0 = header) but the text lives at index 3 — search wins.
    assert.strictEqual(locateLine(lines, 1, 'ERROR connection refused'), 3);
  });

  test('searches by text when there is no usable hint', () => {
    assert.strictEqual(locateLine(lines, 0, 'nominal chatter'), 2);
  });

  test('keeps the valid hint when the text cannot be found (best effort)', () => {
    assert.strictEqual(locateLine(lines, 3, 'text that is nowhere'), 2);
  });

  test('empty text with a valid hint returns the hint', () => {
    assert.strictEqual(locateLine(lines, 5, ''), 4);
  });

  test('returns -1 when nothing can be located', () => {
    assert.strictEqual(locateLine(lines, 0, ''), -1);
    assert.strictEqual(locateLine(lines, 99, 'missing'), -1);
  });
});
