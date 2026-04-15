/**
 * Tests for signal report "Signal Details" section — type-specific details
 * and distribution analysis (clustering vs spread).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDetailsHtml, buildDetailsMarkdown } from '../../ui/signals/signal-report-details';
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

// --- Distribution analysis ---

test('buildDetailsHtml: should show distribution for errors with multiple occurrences', () => {
  const bundle = makeBundle({
    errors: [
      { lineIndex: 10, excerpt: 'err1' },
      { lineIndex: 50, excerpt: 'err2' },
      { lineIndex: 90, excerpt: 'err3' },
    ],
  });
  const html = buildDetailsHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle);

  assert.ok(html.includes('First occurrence'), 'should show first occurrence');
  assert.ok(html.includes('Last occurrence'), 'should show last occurrence');
  assert.ok(html.includes('Span'), 'should show span');
  assert.ok(html.includes('Pattern'), 'should show clustering pattern');
});

test('buildDetailsHtml: should detect clustered pattern', () => {
  // 6 errors: 5 clustered near line 100, 1 outlier at line 0 to widen the span.
  // With span=104, bucketSize=ceil(104/10)=11. The cluster at 100-104 falls in
  // one bucket (bucket 9), holding 5/6 = 83% of items — well above the 50% threshold.
  const bundle = makeBundle({
    errors: [
      { lineIndex: 0, excerpt: 'outlier' },
      ...Array.from({ length: 5 }, (_, i) => ({
        lineIndex: 100 + i,
        excerpt: `err${i}`,
      })),
    ],
  });
  const html = buildDetailsHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle);
  assert.ok(html.includes('Clustered'), 'should detect clustering when errors are grouped');
});

test('buildDetailsHtml: should detect spread pattern', () => {
  // 3 errors spread across 1000 lines, in different buckets
  const bundle = makeBundle({
    errors: [
      { lineIndex: 10, excerpt: 'e1' },
      { lineIndex: 500, excerpt: 'e2' },
      { lineIndex: 990, excerpt: 'e3' },
    ],
  });
  const html = buildDetailsHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle);
  assert.ok(html.includes('Spread'), 'should detect spread when errors are distributed');
});

test('buildDetailsHtml: should return empty for single occurrence', () => {
  const bundle = makeBundle({
    errors: [{ lineIndex: 5, excerpt: 'only one' }],
  });
  // Single error = no distribution data (needs >= 2)
  const html = buildDetailsHtml(makeHypothesis({ hypothesisKey: 'err::x' }), bundle);
  assert.ok(!html.includes('First occurrence'), 'no distribution for single occurrence');
});

// --- N+1 query details ---

test('buildDetailsHtml: should show N+1 query details when evidence matches', () => {
  const bundle = makeBundle({
    nPlusOneHints: [{
      lineIndex: 42,
      fingerprint: 'SELECT * FROM users',
      repeats: 15,
      distinctArgs: 3,
      windowSpanMs: 2500,
      confidence: 'high',
    }],
  });
  const hypothesis = makeHypothesis({
    templateId: 'n-plus-one',
    hypothesisKey: 'n1::fp',
    evidenceLineIds: [42],
  });
  const html = buildDetailsHtml(hypothesis, bundle);

  assert.ok(html.includes('SELECT * FROM users'), 'should show fingerprint');
  assert.ok(html.includes('15'), 'should show repeat count');
  assert.ok(html.includes('3'), 'should show distinct args');
  assert.ok(html.includes('2.5s'), 'should show window span');
});

// --- SQL burst details ---

test('buildDetailsHtml: should show SQL burst details', () => {
  const bundle = makeBundle({
    sqlBursts: [{ fingerprint: 'INSERT INTO logs', count: 20, windowMs: 1000 }],
  });
  const hypothesis = makeHypothesis({ templateId: 'sql-burst', hypothesisKey: 'burst::fp' });
  const html = buildDetailsHtml(hypothesis, bundle);

  assert.ok(html.includes('INSERT INTO logs'), 'should show burst fingerprint');
  assert.ok(html.includes('20 queries'), 'should show query count');
  assert.ok(html.includes('1.0s'), 'should show window duration');
});

// --- ANR details ---

test('buildDetailsHtml: should show ANR score, level, and contributing factors', () => {
  const bundle = makeBundle({
    anrRisk: {
      score: 75,
      level: 'high',
      signals: ['blocking I/O on main thread', 'synchronous network call'],
    },
  });
  const hypothesis = makeHypothesis({ templateId: 'anr-risk', hypothesisKey: 'anr::risk' });
  const html = buildDetailsHtml(hypothesis, bundle);

  assert.ok(html.includes('75'), 'should show ANR score');
  assert.ok(html.includes('high'), 'should show risk level');
  assert.ok(html.includes('blocking I/O on main thread'), 'should list contributing factors');
  assert.ok(html.includes('synchronous network call'), 'should list all factors');
});

// --- Drift Advisor details ---

test('buildDetailsHtml: should show Drift Advisor issue count and top rule', () => {
  const bundle = makeBundle({
    driftAdvisorSummary: { issueCount: 3, topRuleId: 'DRIFT-042' },
  });
  const hypothesis = makeHypothesis({ templateId: 'drift-advisor', hypothesisKey: 'drift::advisor' });
  const html = buildDetailsHtml(hypothesis, bundle);

  assert.ok(html.includes('3'), 'should show issue count');
  assert.ok(html.includes('DRIFT-042'), 'should show top rule ID');
});

// --- Session diff details ---

test('buildDetailsHtml: should show regression fingerprints', () => {
  const bundle = makeBundle({
    sessionDiffSummary: {
      regressionFingerprints: ['SELECT * FROM orders', 'INSERT INTO audit_log'],
    },
  });
  const hypothesis = makeHypothesis({ templateId: 'session-diff', hypothesisKey: 'diff::regression' });
  const html = buildDetailsHtml(hypothesis, bundle);

  assert.ok(html.includes('SELECT * FROM orders'), 'should show first regression');
  assert.ok(html.includes('INSERT INTO audit_log'), 'should show second regression');
});

// --- Empty/no details ---

test('buildDetailsHtml: should return empty string for unknown template with no data', () => {
  const bundle = makeBundle();
  const hypothesis = makeHypothesis({ templateId: 'unknown', hypothesisKey: 'unk::x' });
  const html = buildDetailsHtml(hypothesis, bundle);
  assert.strictEqual(html, '');
});

// --- Markdown export ---

test('buildDetailsMarkdown: should include distribution in markdown', () => {
  const bundle = makeBundle({
    errors: [
      { lineIndex: 10, excerpt: 'e1' },
      { lineIndex: 200, excerpt: 'e2' },
    ],
  });
  const md = buildDetailsMarkdown(makeHypothesis({ hypothesisKey: 'err::x' }), bundle);

  assert.ok(md.includes('## Distribution'));
  assert.ok(md.includes('Line 11'));
  assert.ok(md.includes('Line 201'));
});

test('buildDetailsMarkdown: should include ANR details in markdown', () => {
  const bundle = makeBundle({
    anrRisk: { score: 60, level: 'medium', signals: ['heavy computation'] },
  });
  const md = buildDetailsMarkdown(
    makeHypothesis({ templateId: 'anr-risk', hypothesisKey: 'anr::risk' }),
    bundle,
  );

  assert.ok(md.includes('## ANR Details'));
  assert.ok(md.includes('60'));
  assert.ok(md.includes('heavy computation'));
});
