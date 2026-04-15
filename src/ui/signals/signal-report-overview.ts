/**
 * Session overview and other-signals sections for the signal report.
 * Shows aggregate stats from the bundle and lists other detected signals.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { buildHypotheses } from '../../modules/root-cause-hints/build-hypotheses';

interface OverviewOptions {
  readonly bundle: RootCauseHintBundle;
  readonly logLineCount: number;
  readonly logFilePath: string | undefined;
}

/** Build session overview HTML showing aggregate stats from the bundle. */
export function buildOverviewHtml(opts: OverviewOptions): string {
  const { bundle, logLineCount, logFilePath } = opts;
  const parts: string[] = [];
  if (logFilePath) {
    parts.push(overviewRow('Log file', logFilePath));
  }
  parts.push(overviewRow('Log lines', logLineCount.toLocaleString()));
  parts.push(overviewRow('Session', bundle.sessionId));

  // Aggregate counts rendered as stat cards
  const stats = gatherStats(bundle);
  if (stats.length > 0) {
    parts.push('<div class="overview-stats">');
    for (const s of stats) {
      parts.push(
        `<div class="overview-stat">` +
        `<span class="stat-count">${s.count}</span>` +
        `<span class="stat-label">${escapeHtml(s.label)}</span>` +
        `</div>`,
      );
    }
    parts.push('</div>');
  }
  return parts.join('');
}

/** Build other-signals HTML listing hypotheses from the same session (excluding current). */
export function buildOtherSignalsHtml(
  current: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): string {
  const all = buildHypotheses(bundle);
  const others = all.filter(h => h.hypothesisKey !== current.hypothesisKey);
  if (others.length === 0) {
    return '<div class="no-data">No other signals detected in this session</div>';
  }
  const parts: string[] = [];
  for (const h of others) {
    const conf = h.confidence ?? 'low';
    parts.push(
      `<div class="other-signal">` +
      `<span class="conf-badge conf-badge--${escapeHtml(conf)}">${escapeHtml(conf)}</span>` +
      `<span class="other-signal-text">${escapeHtml(h.text)}</span>` +
      `</div>`,
    );
  }
  return parts.join('');
}

/** Build overview section as markdown for the export report. */
export function buildOverviewMarkdown(opts: OverviewOptions): string {
  const { bundle, logLineCount, logFilePath } = opts;
  const lines: string[] = ['## Session Overview', ''];
  if (logFilePath) {
    lines.push(`- **Log file:** \`${logFilePath}\``);
  }
  lines.push(`- **Log lines:** ${logLineCount.toLocaleString()}`);
  lines.push(`- **Session:** ${bundle.sessionId}`);
  const stats = gatherStats(bundle);
  for (const s of stats) {
    lines.push(`- **${s.label}:** ${s.count}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Build other-signals section as markdown for the export report. */
export function buildOtherSignalsMarkdown(
  current: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
): string {
  const all = buildHypotheses(bundle);
  const others = all.filter(h => h.hypothesisKey !== current.hypothesisKey);
  if (others.length === 0) { return ''; }
  const lines: string[] = ['## Other Signals', ''];
  for (const h of others) {
    const conf = h.confidence ?? 'low';
    lines.push(`- **[${conf}]** ${h.text}`);
  }
  lines.push('');
  return lines.join('\n');
}

interface StatItem {
  readonly label: string;
  readonly count: number;
}

/** Collect non-zero aggregate counts from the bundle for display. */
function gatherStats(bundle: RootCauseHintBundle): StatItem[] {
  const items: StatItem[] = [];
  addStat(items, 'Errors', bundle.errors?.length);
  // Sum warning counts across all groups (each group has a repeat count)
  const warnTotal = bundle.warningGroups?.reduce((sum, g) => sum + (g?.count ?? 0), 0);
  addStat(items, 'Warnings', warnTotal);
  addStat(items, 'Network failures', bundle.networkFailures?.length);
  addStat(items, 'Memory events', bundle.memoryEvents?.length);
  addStat(items, 'Slow operations', bundle.slowOperations?.length);
  addStat(items, 'Permission denials', bundle.permissionDenials?.length);
  addStat(items, 'Classified errors', bundle.classifiedErrors?.length);
  addStat(items, 'SQL bursts', bundle.sqlBursts?.length);
  addStat(items, 'N+1 queries', bundle.nPlusOneHints?.length);
  if (bundle.anrRisk && bundle.anrRisk.score > 0) {
    items.push({ label: `ANR risk (${bundle.anrRisk.level})`, count: bundle.anrRisk.score });
  }
  if (bundle.driftAdvisorSummary && bundle.driftAdvisorSummary.issueCount > 0) {
    items.push({ label: 'Drift Advisor issues', count: bundle.driftAdvisorSummary.issueCount });
  }
  return items;
}

function addStat(items: StatItem[], label: string, count: number | undefined): void {
  if (count && count > 0) { items.push({ label, count }); }
}

function overviewRow(label: string, value: string): string {
  return (
    `<div class="overview-row">` +
    `<span class="overview-label">${escapeHtml(label)}</span>` +
    `<span class="overview-value">${escapeHtml(value)}</span>` +
    `</div>`
  );
}
