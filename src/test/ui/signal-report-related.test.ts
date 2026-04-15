/**
 * Tests for signal report "Related Lines" section rendering.
 * Verifies that related items show actual excerpts and line numbers
 * instead of the old summary-only counts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRelatedHtml, resolveText } from '../../ui/signals/signal-report-related';
import type { RootCauseHintBundle, RootCauseHypothesis } from '../../modules/root-cause-hints/root-cause-hint-types';

function makeBundle(overrides: Partial<RootCauseHintBundle> = {}): RootCauseHintBundle {
  return { bundleVersion: 2, sessionId: 'test-session', ...overrides };
}

function makeHypothesis(overrides: Partial<RootCauseHypothesis> = {}): RootCauseHypothesis {
  return {
    templateId: 'error-recent',
    text: 'Error: test',
    evidenceLineIds: [0],
    hypothesisKey: 'err::abc',
    ...overrides,
  };
}

// --- resolveText ---

test('resolveText: should return log line when index is in range', () => {
  assert.strictEqual(resolveText(['zero', 'one', 'two'], 1, 'fallback'), 'one');
});

test('resolveText: should return fallback when index is out of range', () => {
  assert.strictEqual(resolveText(['zero'], 5, 'fallback'), 'fallback');
});

test('resolveText: should return fallback when index is negative', () => {
  assert.strictEqual(resolveText(['zero'], -1, 'fallback'), 'fallback');
});

// --- Error related ---

test('buildRelatedHtml: should show each error with line number and excerpt', () => {
  const bundle = makeBundle({
    errors: [
      { lineIndex: 10, excerpt: 'INSERT failed' },
      { lineIndex: 50, excerpt: 'INSERT failed again' },
    ],
  });
  const hypothesis = makeHypothesis({ hypothesisKey: 'err::fp1' });
  const html = buildRelatedHtml(hypothesis, bundle, []);

  // Before: just "2 error(s) in this session match this pattern"
  // After: each error listed with line number
  assert.ok(html.includes('Line 11'), 'should show 1-based line number for first error');
  assert.ok(html.includes('Line 51'), 'should show 1-based line number for second error');
  assert.ok(html.includes('INSERT failed'), 'should show error excerpt');
  assert.ok(html.includes('2 error(s)'), 'should show summary count');
});

test('buildRelatedHtml: should prefer log file content over excerpt', () => {
  const bundle = makeBundle({
    errors: [{ lineIndex: 0, excerpt: 'short excerpt' }],
  });
  const logLines = ['Full log line with more detail than the excerpt'];
  const html = buildRelatedHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle, logLines);

  // Should use actual log line content, not the truncated excerpt
  assert.ok(html.includes('Full log line with more detail'));
  assert.ok(!html.includes('short excerpt'));
});

test('buildRelatedHtml: should escape HTML in error excerpts', () => {
  const bundle = makeBundle({
    errors: [{ lineIndex: 0, excerpt: '<script>alert(1)</script>' }],
  });
  const html = buildRelatedHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle, []);

  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
});

test('buildRelatedHtml: should show no-data for empty errors', () => {
  const bundle = makeBundle({ errors: [] });
  const html = buildRelatedHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle, []);
  assert.ok(html.includes('No error details'));
});

// --- Warning related ---

test('buildRelatedHtml: should show warning locations with actual log lines', () => {
  const bundle = makeBundle({
    warningGroups: [{
      excerpt: 'deprecated API call',
      count: 3,
      lineIndices: [5, 15, 25],
    }],
  });
  const logLines = Array.from({ length: 30 }, (_, i) => `log line ${i}`);
  // excerptKey normalizes to lowercase last 80 chars
  const hypothesis = makeHypothesis({
    hypothesisKey: 'warn::deprecated api call',
    templateId: 'warning-recurring',
  });
  const html = buildRelatedHtml(hypothesis, bundle, logLines);

  assert.ok(html.includes('Line 6'), 'should show first warning location');
  assert.ok(html.includes('Line 16'), 'should show second warning location');
  assert.ok(html.includes('Line 26'), 'should show third warning location');
  assert.ok(html.includes('log line 5'), 'should use actual log content');
});

// --- Network failure related ---

test('buildRelatedHtml: should show network failures with excerpts', () => {
  const bundle = makeBundle({
    networkFailures: [
      { lineIndex: 3, excerpt: 'Connection refused', pattern: '5xx' },
      { lineIndex: 7, excerpt: 'Timeout', pattern: 'timeout' },
    ],
  });
  const hypothesis = makeHypothesis({
    hypothesisKey: 'net::5xx',
    templateId: 'network-failure',
  });
  const html = buildRelatedHtml(hypothesis, bundle, []);

  assert.ok(html.includes('2 network failure(s)'));
  assert.ok(html.includes('Connection refused'));
  assert.ok(html.includes('Timeout'));
});

// --- Slow operations related ---

test('buildRelatedHtml: should show slow ops sorted by duration with badge', () => {
  const bundle = makeBundle({
    slowOperations: [
      { lineIndex: 1, excerpt: 'fast op', durationMs: 500 },
      { lineIndex: 2, excerpt: 'slow op', durationMs: 5000 },
    ],
  });
  const hypothesis = makeHypothesis({
    hypothesisKey: 'slow::fast op',
    templateId: 'slow-operation',
  });
  const html = buildRelatedHtml(hypothesis, bundle, []);

  // Slowest first
  const slowIdx = html.indexOf('slow op');
  const fastIdx = html.indexOf('fast op');
  assert.ok(slowIdx < fastIdx, 'slowest operation should appear first');
  assert.ok(html.includes('5.0s'), 'should show duration badge');
});

// --- Classified errors related ---

test('buildRelatedHtml: should show classified errors with severity badge', () => {
  const bundle = makeBundle({
    classifiedErrors: [
      { lineIndex: 0, excerpt: 'null ref', classification: 'bug' as const },
      { lineIndex: 5, excerpt: 'crash', classification: 'critical' as const },
    ],
  });
  const hypothesis = makeHypothesis({
    hypothesisKey: 'cls::bug',
    templateId: 'classified-bug',
  });
  const html = buildRelatedHtml(hypothesis, bundle, []);

  assert.ok(html.includes('bug'), 'should show bug classification badge');
  assert.ok(html.includes('critical'), 'should show critical classification badge');
});

// --- Unknown key prefix ---

test('buildRelatedHtml: should show no-data for unknown key prefix', () => {
  const bundle = makeBundle();
  const hypothesis = makeHypothesis({ hypothesisKey: 'unknown::xyz' });
  const html = buildRelatedHtml(hypothesis, bundle, []);
  assert.ok(html.includes('No additional related lines'));
});

// --- Overflow handling ---

test('buildRelatedHtml: should show overflow message when items exceed max', () => {
  // Create 25 errors — exceeds the 20-item cap
  const errors = Array.from({ length: 25 }, (_, i) => ({
    lineIndex: i,
    excerpt: `error ${i}`,
  }));
  const bundle = makeBundle({ errors });
  const html = buildRelatedHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle, []);

  assert.ok(html.includes('...and 5 more'), 'should show overflow count');
});
