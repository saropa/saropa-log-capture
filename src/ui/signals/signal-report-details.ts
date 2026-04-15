/**
 * Signal-type-specific detail section for the signal report.
 * Shows data fields unique to each signal type (N+1 queries, SQL bursts, ANR, etc.)
 * and distribution analysis for signals with multiple occurrences.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { excerptKey } from '../../modules/root-cause-hints/build-hypotheses-text';

/** Build type-specific detail HTML. Returns empty string if no extra detail available. */
export function buildDetailsHtml(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): string {
  const parts: string[] = [];
  // Distribution analysis (clustering vs spread) for signals with multiple occurrences
  const distHtml = buildDistribution(hypothesis, bundle);
  if (distHtml) { parts.push(distHtml); }
  // Type-specific details (N+1, SQL burst, ANR, etc.)
  const typeHtml = buildTypeDetails(hypothesis, bundle);
  if (typeHtml) { parts.push(typeHtml); }
  return parts.join('');
}

/** Build markdown version of the details section for export. */
export function buildDetailsMarkdown(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): string {
  const lines: string[] = [];
  const dist = getDistributionData(hypothesis, bundle);
  if (dist) {
    lines.push('## Distribution', '');
    lines.push(`- **First occurrence:** Line ${dist.first + 1}`);
    lines.push(`- **Last occurrence:** Line ${dist.last + 1}`);
    lines.push(`- **Span:** ${dist.span} lines`);
    lines.push(`- **Pattern:** ${dist.pattern}`);
    lines.push('');
  }
  appendTypeMarkdown(lines, hypothesis, bundle);
  if (lines.length === 0) { return ''; }
  return lines.join('\n');
}

/** Dispatch to the type-specific detail builder based on templateId. */
function buildTypeDetails(hypothesis: RootCauseHypothesis, bundle: RootCauseHintBundle): string {
  switch (hypothesis.templateId) {
    case 'n-plus-one': return buildNPlusOne(hypothesis, bundle);
    case 'sql-burst': return buildSqlBurst(bundle);
    case 'fingerprint-leader': return buildFpLeader(bundle);
    case 'anr-risk': return buildAnr(bundle);
    case 'drift-advisor': return buildDriftAdvisor(bundle);
    case 'session-diff': return buildSessionDiff(bundle);
    default: return '';
  }
}

/** N+1 query details: fingerprint, repeats, distinct args, window span. */
function buildNPlusOne(hypothesis: RootCauseHypothesis, bundle: RootCauseHintBundle): string {
  const hints = bundle.nPlusOneHints;
  if (!hints || hints.length === 0) { return ''; }
  // Find the hint that matches this hypothesis by checking evidence overlap
  const evidenceSet = new Set(hypothesis.evidenceLineIds);
  const match = hints.find(h => h && evidenceSet.has(h.lineIndex));
  if (!match) {
    // Show summary of all N+1 hints if can't match specific one
    const rows = hints.slice(0, 5)
      .filter((h): h is NonNullable<typeof h> => !!h)
      .map(h => detailRow(h.fingerprint, `${h.repeats} repeats, ${h.distinctArgs} distinct args`));
    return wrapGrid(rows);
  }
  return wrapGrid([
    detailRow('Query fingerprint', match.fingerprint),
    detailRow('Repetitions', String(match.repeats)),
    detailRow('Distinct arguments', String(match.distinctArgs)),
    detailRow('Window span', `${(match.windowSpanMs / 1000).toFixed(1)}s`),
    detailRow('Confidence', match.confidence),
  ]);
}

/** SQL burst details: fingerprint, count, window duration. */
function buildSqlBurst(bundle: RootCauseHintBundle): string {
  const bursts = bundle.sqlBursts;
  if (!bursts || bursts.length === 0) { return ''; }
  const rows: string[] = [];
  for (const b of bursts.slice(0, 5)) {
    if (!b) { continue; }
    const window = b.windowMs ? ` in ${(b.windowMs / 1000).toFixed(1)}s` : '';
    rows.push(detailRow(b.fingerprint, `${b.count} queries${window}`));
  }
  return wrapGrid(rows);
}

/** Fingerprint leader details: fingerprint, count, sample line. */
function buildFpLeader(bundle: RootCauseHintBundle): string {
  const leaders = bundle.fingerprintLeaders;
  if (!leaders || leaders.length === 0) { return ''; }
  const rows: string[] = [];
  for (const f of leaders.slice(0, 5)) {
    if (!f) { continue; }
    rows.push(detailRow(f.fingerprint, `${f.count} occurrences (sample: line ${f.sampleLineIndex + 1})`));
  }
  return wrapGrid(rows);
}

/** ANR risk details: score, level, and contributing factors list. */
function buildAnr(bundle: RootCauseHintBundle): string {
  const anr = bundle.anrRisk;
  if (!anr) { return ''; }
  const rows: string[] = [
    detailRow('ANR score', String(anr.score)),
    detailRow('Risk level', anr.level),
  ];
  if (anr.signals.length > 0) {
    rows.push('<div class="detail-subheading">Contributing factors</div>');
    for (const sig of anr.signals) {
      rows.push(`<div class="detail-factor">${escapeHtml(sig)}</div>`);
    }
  }
  return wrapGrid(rows);
}

/** Drift Advisor summary: issue count and top rule. */
function buildDriftAdvisor(bundle: RootCauseHintBundle): string {
  const da = bundle.driftAdvisorSummary;
  if (!da || da.issueCount <= 0) { return ''; }
  const rows: string[] = [
    detailRow('Issues found', String(da.issueCount)),
  ];
  if (da.topRuleId) {
    rows.push(detailRow('Top rule', da.topRuleId));
  }
  return wrapGrid(rows);
}

/** Session diff regression: fingerprints that regressed compared to previous sessions. */
function buildSessionDiff(bundle: RootCauseHintBundle): string {
  const diff = bundle.sessionDiffSummary;
  if (!diff?.regressionFingerprints || diff.regressionFingerprints.length === 0) { return ''; }
  const rows = diff.regressionFingerprints.slice(0, 10)
    .map(fp => detailRow('Regression', fp));
  return wrapGrid(rows);
}

// --- Distribution analysis ---

interface DistributionData {
  readonly first: number;
  readonly last: number;
  readonly span: number;
  readonly pattern: string;
}

/** Extract distribution data, or undefined if fewer than 2 occurrences. */
function getDistributionData(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): DistributionData | undefined {
  const indices = collectIndices(hypothesis, bundle);
  if (indices.length < 2) { return undefined; }
  const sorted = indices.slice().sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last - first;
  return { first, last, span, pattern: analyzePattern(sorted, span) };
}

/** Build distribution HTML as a detail grid. */
function buildDistribution(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): string {
  const dist = getDistributionData(hypothesis, bundle);
  if (!dist) { return ''; }
  return wrapGrid([
    detailRow('First occurrence', `Line ${dist.first + 1}`),
    detailRow('Last occurrence', `Line ${dist.last + 1}`),
    detailRow('Span', `${dist.span} lines`),
    detailRow('Pattern', dist.pattern),
  ]);
}

/** Collect all line indices relevant to this hypothesis from the bundle. */
function collectIndices(hypothesis: RootCauseHypothesis, bundle: RootCauseHintBundle): number[] {
  const key = hypothesis.hypothesisKey;
  // Use bundle data for known types (has more indices than the capped evidenceLineIds)
  if (key.startsWith('err::') && bundle.errors) {
    return bundle.errors.filter((e): e is NonNullable<typeof e> => !!e).map(e => e.lineIndex);
  }
  if (key.startsWith('warn::') && bundle.warningGroups) {
    const wk = key.slice(6);
    for (const g of bundle.warningGroups) {
      if (!g) { continue; }
      if (excerptKey(g.excerpt) === wk) { return [...g.lineIndices]; }
    }
  }
  if (key.startsWith('net::') && bundle.networkFailures) {
    return bundle.networkFailures.filter((f): f is NonNullable<typeof f> => !!f).map(f => f.lineIndex);
  }
  // Fall back to hypothesis evidenceLineIds for other types
  return [...hypothesis.evidenceLineIds];
}

/** Determine whether occurrences are clustered in one region or spread across the log. */
function analyzePattern(sorted: number[], span: number): string {
  if (span === 0) { return 'All on the same line'; }
  // Divide the span into 10 equal buckets and check if >50% fall in one bucket
  const bucketSize = Math.max(1, Math.ceil(span / 10));
  const buckets = new Map<number, number>();
  for (const idx of sorted) {
    const bucket = Math.floor((idx - sorted[0]) / bucketSize);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const maxBucket = Math.max(...buckets.values());
  const ratio = maxBucket / sorted.length;
  if (ratio > 0.5 && sorted.length >= 3) {
    return `Clustered (${Math.round(ratio * 100)}% in one region)`;
  }
  return 'Spread across the log';
}

/** Append type-specific markdown for the export report. */
function appendTypeMarkdown(
  lines: string[],
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): void {
  if (hypothesis.templateId === 'anr-risk' && bundle.anrRisk) {
    lines.push('## ANR Details', '');
    lines.push(`- **Score:** ${bundle.anrRisk.score}`);
    lines.push(`- **Level:** ${bundle.anrRisk.level}`);
    if (bundle.anrRisk.signals.length > 0) {
      lines.push('- **Contributing factors:**');
      for (const sig of bundle.anrRisk.signals) {
        lines.push(`  - ${sig}`);
      }
    }
    lines.push('');
  }
  if (hypothesis.templateId === 'n-plus-one' && bundle.nPlusOneHints) {
    const evidenceSet = new Set(hypothesis.evidenceLineIds);
    const match = bundle.nPlusOneHints.find(h => h && evidenceSet.has(h.lineIndex));
    if (match) {
      lines.push('## N+1 Query Details', '');
      lines.push(`- **Fingerprint:** ${match.fingerprint}`);
      lines.push(`- **Repetitions:** ${match.repeats}`);
      lines.push(`- **Distinct arguments:** ${match.distinctArgs}`);
      lines.push(`- **Window:** ${(match.windowSpanMs / 1000).toFixed(1)}s`);
      lines.push('');
    }
  }
  if (hypothesis.templateId === 'sql-burst' && bundle.sqlBursts) {
    lines.push('## SQL Burst Details', '');
    for (const b of bundle.sqlBursts.slice(0, 5)) {
      if (!b) { continue; }
      const window = b.windowMs ? ` in ${(b.windowMs / 1000).toFixed(1)}s` : '';
      lines.push(`- **${b.fingerprint}:** ${b.count} queries${window}`);
    }
    lines.push('');
  }
  if (hypothesis.templateId === 'drift-advisor' && bundle.driftAdvisorSummary) {
    const da = bundle.driftAdvisorSummary;
    lines.push('## Drift Advisor Details', '');
    lines.push(`- **Issues found:** ${da.issueCount}`);
    if (da.topRuleId) {
      lines.push(`- **Top rule:** ${da.topRuleId}`);
    }
    lines.push('');
  }
  if (hypothesis.templateId === 'session-diff' && bundle.sessionDiffSummary?.regressionFingerprints) {
    const fps = bundle.sessionDiffSummary.regressionFingerprints;
    if (fps.length > 0) {
      lines.push('## Session Diff Regressions', '');
      for (const fp of fps.slice(0, 10)) {
        lines.push(`- ${fp}`);
      }
      lines.push('');
    }
  }
}

function detailRow(label: string, value: string): string {
  return (
    `<div class="detail-row">` +
    `<span class="detail-label">${escapeHtml(label)}</span>` +
    `<span class="detail-value">${escapeHtml(value)}</span>` +
    `</div>`
  );
}

function wrapGrid(rows: string[]): string {
  return `<div class="detail-grid">${rows.join('')}</div>`;
}
