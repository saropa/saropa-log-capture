/**
 * Tests for signal report "Session Overview" and "Other Signals" sections.
 * Verifies aggregate stats display and cross-signal listing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewHtml, buildOtherSignalsHtml, buildOverviewMarkdown, buildOtherSignalsMarkdown } from '../../ui/signals/signal-report-overview';
import type { RootCauseHintBundle, RootCauseHypothesis } from '../../modules/root-cause-hints/root-cause-hint-types';

function makeBundle(overrides: Partial<RootCauseHintBundle> = {}): RootCauseHintBundle {
  return { bundleVersion: 2, sessionId: 'sess-123', ...overrides };
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

// --- buildOverviewHtml ---

test('buildOverviewHtml: should show log line count and session ID', () => {
  const html = buildOverviewHtml({
    bundle: makeBundle(),
    logLineCount: 1500,
    logFilePath: undefined,
  });
  assert.ok(html.includes('1,500'), 'should format line count with commas');
  assert.ok(html.includes('sess-123'), 'should show session ID');
});

test('buildOverviewHtml: should show log file path when provided', () => {
  const html = buildOverviewHtml({
    bundle: makeBundle(),
    logLineCount: 100,
    logFilePath: '/home/user/reports/session.log',
  });
  assert.ok(html.includes('/home/user/reports/session.log'));
});

test('buildOverviewHtml: should show stat cards for non-zero counts', () => {
  const bundle = makeBundle({
    errors: [
      { lineIndex: 0, excerpt: 'e1' },
      { lineIndex: 1, excerpt: 'e2' },
      { lineIndex: 2, excerpt: 'e3' },
    ],
    networkFailures: [
      { lineIndex: 5, excerpt: 'nf1', pattern: 'timeout' },
    ],
  });
  const html = buildOverviewHtml({ bundle, logLineCount: 500, logFilePath: undefined });

  assert.ok(html.includes('stat-count'), 'should render stat cards');
  assert.ok(html.includes('Errors'), 'should show error label');
  assert.ok(html.includes('3'), 'should show error count');
  assert.ok(html.includes('Network failures'), 'should show network failure label');
});

test('buildOverviewHtml: should not show stat cards when bundle has no signals', () => {
  const html = buildOverviewHtml({
    bundle: makeBundle(),
    logLineCount: 100,
    logFilePath: undefined,
  });
  // No stat cards — just the overview rows (log lines, session)
  assert.ok(!html.includes('overview-stats'), 'should not render stats section');
});

test('buildOverviewHtml: should escape HTML in file path', () => {
  const html = buildOverviewHtml({
    bundle: makeBundle(),
    logLineCount: 10,
    logFilePath: '<script>alert(1)</script>',
  });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
});

test('buildOverviewHtml: should show ANR risk as a stat when present', () => {
  const bundle = makeBundle({
    anrRisk: { score: 45, level: 'medium', signals: [] },
  });
  const html = buildOverviewHtml({ bundle, logLineCount: 100, logFilePath: undefined });
  assert.ok(html.includes('ANR risk (medium)'));
  assert.ok(html.includes('45'));
});

test('buildOverviewHtml: should sum warning counts across groups', () => {
  const bundle = makeBundle({
    warningGroups: [
      { excerpt: 'w1', count: 5, lineIndices: [1, 2, 3, 4, 5] },
      { excerpt: 'w2', count: 3, lineIndices: [10, 11, 12] },
    ],
  });
  const html = buildOverviewHtml({ bundle, logLineCount: 100, logFilePath: undefined });
  // Total warnings = 5 + 3 = 8
  assert.ok(html.includes('8'), 'should sum warning counts across groups');
  assert.ok(html.includes('Warnings'));
});

// --- buildOtherSignalsHtml ---

test('buildOtherSignalsHtml: should show no-data when no other signals exist', () => {
  // Empty bundle produces zero hypotheses from buildHypotheses → "no other signals"
  const bundle = makeBundle();
  const hypothesis = makeHypothesis();
  const html = buildOtherSignalsHtml(hypothesis, bundle);
  assert.ok(html.includes('No other signals'), 'should show no-data when bundle produces no hypotheses');
});

test('buildOtherSignalsHtml: should list other signals with confidence badges', () => {
  // Bundle that produces multiple hypotheses — errors + ANR
  const bundle = makeBundle({
    errors: [{ lineIndex: 0, excerpt: 'error message that is long enough to pass min length' }],
    anrRisk: { score: 50, level: 'high', signals: ['blocking I/O'] },
  });
  // Use a key that won't match either hypothesis, so both show as "other"
  const hypothesis = makeHypothesis({ hypothesisKey: 'fake::nonexistent' });
  const html = buildOtherSignalsHtml(hypothesis, bundle);

  assert.ok(html.includes('conf-badge'), 'should include confidence badges');
});

// --- Markdown export ---

test('buildOverviewMarkdown: should include session stats in markdown', () => {
  const bundle = makeBundle({
    errors: [{ lineIndex: 0, excerpt: 'e1' }],
  });
  const md = buildOverviewMarkdown({ bundle, logLineCount: 250, logFilePath: '/tmp/test.log' });

  assert.ok(md.includes('## Session Overview'));
  assert.ok(md.includes('250'));
  assert.ok(md.includes('/tmp/test.log'));
  assert.ok(md.includes('Errors'));
});

test('buildOtherSignalsMarkdown: should return empty string when no other signals', () => {
  const bundle = makeBundle();
  const md = buildOtherSignalsMarkdown(makeHypothesis(), bundle);
  // Empty bundle = no hypotheses = no others
  assert.strictEqual(md, '');
});
