/**
 * Full markdown export for the signal report.
 * Used by Copy Report and Save Report actions to produce a comprehensive document
 * with all sections (overview, evidence with context, details, related items, other signals).
 */

import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { resolveSourcePaths } from './signal-report-render';
import { buildOverviewMarkdown, buildOtherSignalsMarkdown } from './signal-report-overview';
import { buildDetailsMarkdown } from './signal-report-details';
import { resolveText } from './signal-report-related';
import { excerptKey } from '../../modules/root-cause-hints/build-hypotheses-text';
import { loadSignalHistory } from './signal-report-history-loader';
import { buildHistoryMarkdown } from './signal-report-history';

interface MarkdownReportOptions {
  readonly hypothesis: RootCauseHypothesis;
  readonly bundle: RootCauseHintBundle;
  readonly logLines: readonly string[];
  readonly filePath: string | undefined;
  readonly wsRoot: string | undefined;
}

/** Build a complete markdown report with all sections for clipboard or file export. */
export async function buildFullMarkdownReport(opts: MarkdownReportOptions): Promise<string> {
  const { hypothesis, bundle, logLines, filePath, wsRoot } = opts;
  const h = hypothesis;
  const conf = h.confidence ?? 'low';
  const out: string[] = [
    '# Saropa Signal Report',
    '',
    `**Signal:** ${h.text}`,
    `**Confidence:** ${conf}`,
    `**Template:** ${h.templateId}`,
  ];
  if (filePath) {
    out.push(`**Log file:** \`${filePath}\``);
  }
  out.push('', '---', '');

  // Session overview — aggregate stats
  out.push(buildOverviewMarkdown({
    bundle,
    logLineCount: logLines.length,
    logFilePath: filePath,
  }));

  // Evidence lines with surrounding context
  appendEvidenceMarkdown(out, h.evidenceLineIds, logLines, wsRoot);

  // Signal-type details (distribution, N+1, SQL burst, ANR, etc.)
  const detailsMd = buildDetailsMarkdown(hypothesis, bundle);
  if (detailsMd) { out.push(detailsMd); }

  // Related items summary
  appendRelatedMarkdown(out, hypothesis, bundle, logLines);

  // Other signals in this session
  const othersMd = buildOtherSignalsMarkdown(hypothesis, bundle);
  if (othersMd) { out.push(othersMd); }

  // Cross-session history
  const history = await loadSignalHistory(hypothesis.templateId);
  const historyMd = buildHistoryMarkdown({
    sessions: history.sessions,
    totalSessionCount: history.totalSessionCount,
  });
  if (historyMd) { out.push('', historyMd); }

  return out.join('\n');
}

/** Append evidence lines with +/- 5 context lines in a code block. */
function appendEvidenceMarkdown(
  out: string[],
  evidenceLineIds: readonly number[],
  logLines: readonly string[],
  wsRoot: string | undefined,
): void {
  if (evidenceLineIds.length === 0 || logLines.length === 0) { return; }
  out.push('## Evidence', '');
  const contextRadius = 5;
  for (const idx of evidenceLineIds) {
    if (idx < 0 || idx >= logLines.length) { continue; }
    const raw = logLines[idx];
    const resolved = wsRoot ? resolveSourcePaths(raw, wsRoot) : raw;
    out.push(`### Line ${idx + 1}`, '');
    out.push(`\`${resolved}\``, '');
    // Context block showing surrounding lines with a >>> marker on the target
    const start = Math.max(0, idx - contextRadius);
    const end = Math.min(logLines.length - 1, idx + contextRadius);
    out.push('```');
    for (let i = start; i <= end; i++) {
      const marker = i === idx ? ' >>>' : '    ';
      const line = wsRoot ? resolveSourcePaths(logLines[i], wsRoot) : logLines[i];
      out.push(`${String(i + 1).padStart(6)}${marker} ${line}`);
    }
    out.push('```', '');
  }
}

/** Append related items as a markdown list. Covers errors and network failures. */
function appendRelatedMarkdown(
  out: string[],
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  logLines: readonly string[],
): void {
  const key = hypothesis.hypothesisKey;
  const items: { lineIndex: number; text: string }[] = [];

  if (key.startsWith('err::') && bundle.errors) {
    for (const e of bundle.errors) {
      if (!e) { continue; }
      items.push({ lineIndex: e.lineIndex, text: resolveText(logLines, e.lineIndex, e.excerpt) });
    }
  } else if (key.startsWith('net::') && bundle.networkFailures) {
    for (const f of bundle.networkFailures) {
      if (!f) { continue; }
      items.push({ lineIndex: f.lineIndex, text: resolveText(logLines, f.lineIndex, f.excerpt) });
    }
  } else if (key.startsWith('warn::') && bundle.warningGroups) {
    // Filter to the matching warning group — key suffix is the excerptKey of the group
    const warnKey = key.slice(6);
    for (const g of bundle.warningGroups) {
      if (!g || excerptKey(g.excerpt) !== warnKey) { continue; }
      for (const idx of g.lineIndices) {
        items.push({ lineIndex: idx, text: resolveText(logLines, idx, g.excerpt) });
      }
    }
  }

  if (items.length === 0) { return; }
  out.push('## Related Lines', '');
  const maxItems = 20;
  for (const item of items.slice(0, maxItems)) {
    out.push(`- **Line ${item.lineIndex + 1}:** ${item.text}`);
  }
  if (items.length > maxItems) {
    out.push(`- ...and ${items.length - maxItems} more`);
  }
  out.push('');
}
