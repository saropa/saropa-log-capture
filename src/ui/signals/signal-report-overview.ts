/**
 * Session overview and other-signals sections for the signal report.
 * Shows aggregate stats from the bundle and lists other detected signals.
 * Also includes session timing, outcome, and error listing.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import { t } from '../../l10n';
import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { buildHypotheses } from '../../modules/root-cause-hints/build-hypotheses';
import { computeSessionHealth, type SessionHealthInput } from '../../modules/misc/session-health';
import {
  parseSessionTiming,
  detectSessionOutcome,
  type SessionOutcome,
} from './signal-report-context';

export interface OverviewOptions {
  readonly bundle: RootCauseHintBundle;
  readonly logLineCount: number;
  readonly logFilePath: string | undefined;
  /** URI string for the log file, so the panel can open it in the viewer. */
  readonly logFileUri?: string;
  /** Path of the auto-saved report, shown as an openable link (HTML panel only). */
  readonly reportFilePath?: string;
  /** URI string for the auto-saved report, so the panel can open it in an editor. */
  readonly reportFileUri?: string;
  readonly logLines?: readonly string[];
}

/** Build session overview HTML showing aggregate stats from the bundle. */
export function buildOverviewHtml(opts: OverviewOptions): string {
  const { bundle, logLineCount, logFilePath, logFileUri, reportFilePath, reportFileUri, logLines } = opts;
  const parts: string[] = [];
  if (logFilePath) {
    // Link opens the log in the viewer when a URI is available; plain text otherwise.
    parts.push(logFileUri
      ? overviewLinkRow(t('signals.overview.logFile'), logFilePath, logFileUri, 'log')
      : overviewRow(t('signals.overview.logFile'), logFilePath));
  }
  if (reportFilePath && reportFileUri) {
    parts.push(overviewLinkRow(t('signals.overview.reportFile'), reportFilePath, reportFileUri, 'file'));
  }
  parts.push(overviewRow(t('signals.overview.logLines'), logLineCount.toLocaleString()));
  parts.push(overviewRow(t('signals.overview.session'), bundle.sessionId));
  // Health score (idea #19): a single 0–100 gauge of the session's signal load.
  parts.push(overviewRow(t('signals.overview.health'), `${sessionHealthScore(bundle)}/100`));

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
        `<span class="stat-label">${escapeHtml(t(s.labelKey, ...s.labelArgs))}</span>` +
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
    return `<div class="no-data">${escapeHtml(t('signals.overview.noOtherSignals'))}</div>`;
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
  const healthBreakdown = sessionHealthBreakdown(bundle);
  lines.push(`- **Health:** ${sessionHealthScore(bundle)}/100${healthBreakdown ? ` (${healthBreakdown})` : ''}`);

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
  /** English label — used by the markdown export, which stays English for GitHub/Slack. */
  readonly label: string;
  /** l10n key + args — used to render the on-screen panel label via t(). */
  readonly labelKey: string;
  readonly labelArgs: readonly (string | number)[];
  readonly count: number;
}

/** Collect non-zero aggregate counts from the bundle for display. */
function gatherStats(bundle: RootCauseHintBundle): StatItem[] {
  const items: StatItem[] = [];
  addStat(items, 'signals.stat.errors', 'Errors', bundle.errors?.length);
  // Sum warning counts across all groups (each group has a repeat count)
  const warnTotal = bundle.warningGroups?.reduce((sum, g) => sum + (g?.count ?? 0), 0);
  addStat(items, 'signals.stat.warnings', 'Warnings', warnTotal);
  addStat(items, 'signals.stat.networkFailures', 'Network failures', bundle.networkFailures?.length);
  addStat(items, 'signals.stat.memoryEvents', 'Memory events', bundle.memoryEvents?.length);
  addStat(items, 'signals.stat.slowOperations', 'Slow operations', bundle.slowOperations?.length);
  addStat(items, 'signals.stat.permissionDenials', 'Permission denials', bundle.permissionDenials?.length);
  addStat(items, 'signals.stat.classifiedErrors', 'Classified errors', bundle.classifiedErrors?.length);
  addStat(items, 'signals.stat.sqlBursts', 'SQL bursts', bundle.sqlBursts?.length);
  addStat(items, 'signals.stat.nPlusOne', 'N+1 queries', bundle.nPlusOneHints?.length);
  if (bundle.anrRisk && bundle.anrRisk.score > 0) {
    items.push({ label: `ANR risk (${bundle.anrRisk.level})`, labelKey: 'signals.stat.anrRisk', labelArgs: [bundle.anrRisk.level], count: bundle.anrRisk.score });
  }
  if (bundle.driftAdvisorSummary && bundle.driftAdvisorSummary.issueCount > 0) {
    items.push({ label: 'Drift Advisor issues', labelKey: 'signals.stat.driftIssues', labelArgs: [], count: bundle.driftAdvisorSummary.issueCount });
  }
  return items;
}

function addStat(items: StatItem[], labelKey: string, label: string, count: number | undefined): void {
  if (count && count > 0) { items.push({ label, labelKey, labelArgs: [], count }); }
}

/** Map the bundle's detected signals to the health-score inputs. */
function sessionHealth(bundle: RootCauseHintBundle): ReturnType<typeof computeSessionHealth> {
  const input: SessionHealthInput = {
    errors: bundle.errors?.length,
    warnings: bundle.warningGroups?.reduce((sum, g) => sum + (g?.count ?? 0), 0),
    networkFailures: bundle.networkFailures?.length,
    memoryEvents: bundle.memoryEvents?.length,
    slowOperations: bundle.slowOperations?.length,
    anrScore: bundle.anrRisk?.score,
  };
  return computeSessionHealth(input);
}

/** The 0–100 score alone, for the on-screen overview row. */
function sessionHealthScore(bundle: RootCauseHintBundle): number {
  return sessionHealth(bundle).score;
}

/** English factor breakdown (e.g. "3 errors -30, ANR -25") for the markdown export, or '' when clean. */
function sessionHealthBreakdown(bundle: RootCauseHintBundle): string {
  return sessionHealth(bundle).factors
    .map((f) => `${f.count} ${f.key} ${f.delta}`)
    .join(', ');
}

function overviewRow(label: string, value: string): string {
  return (
    `<div class="overview-row">` +
    `<span class="overview-label">${escapeHtml(label)}</span>` +
    `<span class="overview-value">${escapeHtml(value)}</span>` +
    `</div>`
  );
}

/**
 * An overview row whose value is a clickable link. The webview's delegated click
 * handler reads data-uri/data-kind and posts an 'openFile' message to the host.
 */
function overviewLinkRow(label: string, value: string, uriString: string, kind: 'log' | 'file'): string {
  return (
    `<div class="overview-row">` +
    `<span class="overview-label">${escapeHtml(label)}</span>` +
    `<a class="overview-value overview-file-link" href="#" ` +
    `data-uri="${escapeHtml(uriString)}" data-kind="${kind}">${escapeHtml(value)}</a>` +
    `</div>`
  );
}

// --- Session timing + outcome helpers ---

/**
 * Format an ISO timestamp to a readable local date+time string.
 * Example: "2026-05-13 10:35:40" — uses 24-hour format for unambiguous log correlation.
 */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) { return iso; }
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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
  if (timing?.startIso) {
    parts.push(overviewRow(t('signals.overview.started'), formatTimestamp(timing.startIso)));
  }
  if (timing?.endIso) {
    parts.push(overviewRow(t('signals.overview.ended'), formatTimestamp(timing.endIso)));
  }
  if (timing?.durationMs) {
    parts.push(overviewRow(t('signals.overview.duration'), formatDuration(timing.durationMs)));
  }
  const outcome = detectSessionOutcome(logLines);
  // Localized outcome for the panel; the markdown export uses outcomeLabel() (English).
  const outcomeText = t(outcome === 'clean-stop' ? 'signals.overview.outcomeCleanStop' : 'signals.overview.outcomeCrash');
  parts.push(overviewRow(t('signals.overview.outcome'), outcomeText));
}

function appendTimingMarkdown(lines: string[], logLines: readonly string[]): void {
  const timing = parseSessionTiming(logLines);
  if (timing?.startIso) {
    lines.push(`- **Started:** ${formatTimestamp(timing.startIso)}`);
  }
  if (timing?.endIso) {
    lines.push(`- **Ended:** ${formatTimestamp(timing.endIso)}`);
  }
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
  parts.push(`<div class="overview-errors-heading">${escapeHtml(t('signals.overview.allErrors'))}</div>`);
  parts.push('<div class="overview-errors-list">');
  for (const e of errs.slice(0, maxErrorList)) {
    if (!e) { continue; }
    const cat = e.category ? ` <span class="error-cat-badge">${escapeHtml(e.category)}</span>` : '';
    parts.push(
      `<div class="overview-error-item">` +
      `<span class="related-line-num">${escapeHtml(t('signals.overview.line', e.lineIndex + 1))}</span>${cat} ` +
      `<span class="overview-error-text">${escapeHtml(e.excerpt)}</span>` +
      `</div>`,
    );
  }
  if (errs.length > maxErrorList) {
    parts.push(`<div class="related-overflow">${escapeHtml(t('signals.overview.andMore', errs.length - maxErrorList))}</div>`);
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
