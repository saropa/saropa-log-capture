/**
 * Session overview and other-signals sections for the signal report.
 * Shows aggregate stats from the bundle and lists other detected signals.
 * Also includes session timing, outcome, and error listing.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { buildHypotheses } from '../../modules/root-cause-hints/build-hypotheses';
import {
  parseSessionTiming,
  detectSessionOutcome,
  type SessionOutcome,
} from './signal-report-context';

export interface OverviewOptions {
  readonly bundle: RootCauseHintBundle;
  readonly logLineCount: number;
  readonly logFilePath: string | undefined;
  readonly logLines?: readonly string[];
}

/** Build session overview HTML showing aggregate stats from the bundle. */
export function buildOverviewHtml(opts: OverviewOptions): string {
  const { bundle, logLineCount, logFilePath, logLines } = opts;
  const parts: string[] = [];
  if (logFilePath) {
    parts.push(overviewRow('Log file', logFilePath));
  }
  parts.push(overviewRow('Log lines', logLineCount.toLocaleString()));
  parts.push(overviewRow('Session', bundle.sessionId));

  // Session timing and outcome (items 5, 9) — extracted from log lines
  if (logLines && logLines.length > 0) {
    appendTimingHtml(parts, logLines);
  }

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

  // All errors in session (item 3) — individual error lines, not just the count
  appendAllErrorsHtml(parts, bundle);

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
  const { bundle, logLineCount, logFilePath, logLines } = opts;
  const lines: string[] = ['## Session Overview', ''];
  if (logFilePath) {
    lines.push(`- **Log file:** \`${logFilePath}\``);
  }
  lines.push(`- **Log lines:** ${logLineCount.toLocaleString()}`);
  lines.push(`- **Session:** ${bundle.sessionId}`);

  // Session timing and outcome
  if (logLines && logLines.length > 0) {
    appendTimingMarkdown(lines, logLines);
  }

  const stats = gatherStats(bundle);
  for (const s of stats) {
    lines.push(`- **${s.label}:** ${s.count}`);
  }

  // All errors in session
  appendAllErrorsMarkdown(lines, bundle);

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

// --- Session timing + outcome helpers ---

/** Format duration in ms to a human-readable string. */
function formatDuration(ms: number): string {
  if (ms < 1000) { return `${ms}ms`; }
  const sec = ms / 1000;
  if (sec < 60) { return `${sec.toFixed(1)}s`; }
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
}

function outcomeLabel(outcome: SessionOutcome): string {
  return outcome === 'clean-stop' ? 'Clean stop' : 'No session footer (possible crash or force-quit)';
}

function appendTimingHtml(parts: string[], logLines: readonly string[]): void {
  const timing = parseSessionTiming(logLines);
  if (timing?.durationMs) {
    parts.push(overviewRow('Duration', formatDuration(timing.durationMs)));
  }
  const outcome = detectSessionOutcome(logLines);
  parts.push(overviewRow('Outcome', outcomeLabel(outcome)));
}

function appendTimingMarkdown(lines: string[], logLines: readonly string[]): void {
  const timing = parseSessionTiming(logLines);
  if (timing?.durationMs) {
    lines.push(`- **Duration:** ${formatDuration(timing.durationMs)}`);
  }
  const outcome = detectSessionOutcome(logLines);
  lines.push(`- **Outcome:** ${outcomeLabel(outcome)}`);
}

// --- All errors listing helpers ---

const maxErrorList = 10;

function appendAllErrorsHtml(parts: string[], bundle: RootCauseHintBundle): void {
  const errs = bundle.errors;
  if (!errs || errs.length <= 1) { return; }
  parts.push('<div class="overview-errors-heading">All errors in session</div>');
  parts.push('<div class="overview-errors-list">');
  for (const e of errs.slice(0, maxErrorList)) {
    if (!e) { continue; }
    const cat = e.category ? ` <span class="error-cat-badge">${escapeHtml(e.category)}</span>` : '';
    parts.push(
      `<div class="overview-error-item">` +
      `<span class="related-line-num">Line ${e.lineIndex + 1}</span>${cat} ` +
      `<span class="overview-error-text">${escapeHtml(e.excerpt)}</span>` +
      `</div>`,
    );
  }
  if (errs.length > maxErrorList) {
    parts.push(`<div class="related-overflow">...and ${errs.length - maxErrorList} more</div>`);
  }
  parts.push('</div>');
}

function appendAllErrorsMarkdown(lines: string[], bundle: RootCauseHintBundle): void {
  const errs = bundle.errors;
  if (!errs || errs.length <= 1) { return; }
  lines.push('');
  lines.push('### All errors in session');
  lines.push('');
  for (const e of errs.slice(0, maxErrorList)) {
    if (!e) { continue; }
    const cat = e.category ? ` [${e.category}]` : '';
    lines.push(`- **Line ${e.lineIndex + 1}:**${cat} ${e.excerpt}`);
  }
  if (errs.length > maxErrorList) {
    lines.push(`- ...and ${errs.length - maxErrorList} more`);
  }
}
