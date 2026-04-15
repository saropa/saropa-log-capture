/**
 * Builds detailed HTML for the "Related Lines" section of signal reports.
 * Shows actual items with excerpts and line numbers instead of summary counts.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { excerptKey } from '../../modules/root-cause-hints/build-hypotheses-text';

/** Maximum related items to show before truncating with "...and N more". */
const maxItems = 20;

/** Build detailed related-lines HTML from bundle data and pre-read log lines. */
export function buildRelatedHtml(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  logLines: readonly string[],
): string {
  const key = hypothesis.hypothesisKey;

  if (key.startsWith('err::')) {
    return buildErrorRelated(bundle, logLines);
  }
  if (key.startsWith('warn::')) {
    return buildWarningRelated(key.slice(6), bundle, logLines);
  }
  if (key.startsWith('net::')) {
    return buildItemListHtml('network failure', bundle.networkFailures, logLines);
  }
  if (key.startsWith('mem::')) {
    return buildItemListHtml('memory event', bundle.memoryEvents, logLines);
  }
  if (key.startsWith('perm::')) {
    return buildItemListHtml('permission denial', bundle.permissionDenials, logLines);
  }
  if (key.startsWith('slow::')) {
    return buildSlowOpRelated(bundle, logLines);
  }
  if (key.startsWith('cls::')) {
    return buildClassifiedRelated(bundle, logLines);
  }

  return '<div class="no-data">No additional related lines found</div>';
}

/** Show all errors from the bundle with line numbers and log content. */
function buildErrorRelated(bundle: RootCauseHintBundle, logLines: readonly string[]): string {
  const errors = bundle.errors;
  if (!errors || errors.length === 0) {
    return '<div class="no-data">No error details available</div>';
  }
  const rows = errors
    .slice(0, maxItems)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map(e => itemRow(e.lineIndex, resolveText(logLines, e.lineIndex, e.excerpt)));
  return wrapList(`${errors.length} error(s) in this session`, rows, errors.length);
}

/** Show all occurrences of the matching warning group with actual log lines. */
function buildWarningRelated(
  warnKey: string,
  bundle: RootCauseHintBundle,
  logLines: readonly string[],
): string {
  const groups = bundle.warningGroups;
  if (!groups) { return '<div class="no-data">No warning details available</div>'; }
  const parts: string[] = [];
  for (const g of groups) {
    if (!g || excerptKey(g.excerpt) !== warnKey) { continue; }
    const rows = g.lineIndices
      .slice(0, maxItems)
      .map(idx => itemRow(idx, resolveText(logLines, idx, g.excerpt)));
    const summary = `Warning repeated ${g.count} time(s) across ${g.lineIndices.length} location(s)`;
    parts.push(wrapList(summary, rows, g.lineIndices.length));
  }
  if (parts.length === 0) {
    return '<div class="no-data">No matching warning groups found</div>';
  }
  return parts.join('');
}

/** Show slow operations sorted by duration (slowest first). */
function buildSlowOpRelated(bundle: RootCauseHintBundle, logLines: readonly string[]): string {
  const ops = bundle.slowOperations;
  if (!ops || ops.length === 0) {
    return '<div class="no-data">No slow operation details available</div>';
  }
  const sorted = ops.slice().sort((a, b) => b.durationMs - a.durationMs);
  const rows = sorted
    .slice(0, maxItems)
    .filter((op): op is NonNullable<typeof op> => !!op)
    .map(op => {
      const sec = (op.durationMs / 1000).toFixed(1);
      const text = resolveText(logLines, op.lineIndex, op.operationName ?? op.excerpt);
      return itemRow(op.lineIndex, text, `${sec}s`);
    });
  return wrapList(`${ops.length} slow operation(s) detected`, rows, ops.length);
}

/** Show classified errors with their severity label (critical / bug). */
function buildClassifiedRelated(bundle: RootCauseHintBundle, logLines: readonly string[]): string {
  const classified = bundle.classifiedErrors;
  if (!classified || classified.length === 0) {
    return '<div class="no-data">No classified error details available</div>';
  }
  const rows = classified
    .slice(0, maxItems)
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map(c => {
      const text = resolveText(logLines, c.lineIndex, c.excerpt);
      return itemRow(c.lineIndex, text, c.classification);
    });
  return wrapList(`${classified.length} classified error(s)`, rows, classified.length);
}

/** Common shape for signal items that have lineIndex + excerpt. */
interface SimpleSignalItem {
  readonly lineIndex: number;
  readonly excerpt: string;
}

/** Generic list builder for signal items with lineIndex + excerpt. */
function buildItemListHtml(
  label: string,
  items: readonly SimpleSignalItem[] | undefined,
  logLines: readonly string[],
): string {
  if (!items || items.length === 0) {
    return `<div class="no-data">No ${escapeHtml(label)} details available</div>`;
  }
  const rows = items
    .slice(0, maxItems)
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map(x => itemRow(x.lineIndex, resolveText(logLines, x.lineIndex, x.excerpt)));
  return wrapList(`${items.length} ${label}(s) detected`, rows, items.length);
}

/** Use actual log line content when available, falling back to the bundle excerpt. */
export function resolveText(logLines: readonly string[], index: number, fallback: string): string {
  if (index >= 0 && index < logLines.length) { return logLines[index]; }
  return fallback;
}

/** Render a single related-item row with line number, optional badge, and text. */
function itemRow(lineIndex: number, text: string, badge?: string): string {
  const lineNum = lineIndex + 1;
  const badgeHtml = badge
    ? ` <span class="related-badge">${escapeHtml(badge)}</span>`
    : '';
  return (
    `<div class="related-item">` +
    `<span class="related-line-num">Line ${lineNum}</span>${badgeHtml}` +
    `<span class="related-excerpt">${escapeHtml(text)}</span>` +
    `</div>`
  );
}

/** Wrap item rows in a summary heading + scrollable list container. */
function wrapList(summary: string, rows: string[], totalCount: number): string {
  const parts = [
    `<div class="related-summary">${escapeHtml(summary)}</div>`,
    '<div class="related-list">',
    ...rows,
  ];
  if (totalCount > maxItems) {
    parts.push(`<div class="related-overflow">...and ${totalCount - maxItems} more</div>`);
  }
  parts.push('</div>');
  return parts.join('');
}
