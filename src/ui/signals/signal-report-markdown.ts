/**
 * Full markdown export for the signal report.
 * Used by Copy Report and Save Report actions to produce a comprehensive document
 * with all sections (overview, evidence with context, details, related items, other signals).
 */

import type {
  RootCauseHintBundle,
  RootCauseHintError,
  RootCauseHypothesis,
} from '../../modules/root-cause-hints/root-cause-hint-types';
import { resolveSourcePaths } from './signal-report-render';
import { buildOverviewMarkdown, buildOtherSignalsMarkdown } from './signal-report-overview';
import { buildDetailsMarkdown } from './signal-report-details';
import { resolveText } from './signal-report-related';
import { excerptKey } from '../../modules/root-cause-hints/build-hypotheses-text';
import { hashFingerprint, normalizeLine } from '../../modules/analysis/error-fingerprint-pure';
import {
  classifyErrorOrigin,
  buildFingerprintNote,
  describeTimelinePosition,
  findPrecedingAction,
  parseSessionHeader,
  type SessionHeader,
} from './signal-report-context';
import { loadSignalHistory } from './signal-report-history-loader';
import { buildHistoryMarkdown } from './signal-report-history';
import { buildEcosystemMarkdown } from './signal-report-ecosystem';

interface MarkdownReportOptions {
  readonly hypothesis: RootCauseHypothesis;
  readonly bundle: RootCauseHintBundle;
  readonly logLines: readonly string[];
  readonly filePath: string | undefined;
  readonly wsRoot: string | undefined;
  /** Pre-parsed clean session header for "what changed" diff (passed from panel). */
  readonly cleanHeader?: SessionHeader;
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
  if (h.confidenceReason) {
    out.push(`**Confidence reason:** ${h.confidenceReason}`);
  }
  if (filePath) {
    out.push(`**Log file:** \`${filePath}\``);
  }
  out.push('', '---', '');

  // Session overview — aggregate stats, timing, outcome, all errors
  out.push(buildOverviewMarkdown({
    bundle,
    logLineCount: logLines.length,
    logFilePath: filePath,
    logLines,
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

  // Companion extensions (Drift Advisor + Saropa Lints)
  const ecosystemMd = buildEcosystemMarkdown(bundle);
  if (ecosystemMd) { out.push(ecosystemMd); }

  // Cross-session history + "what changed" diff
  const history = await loadSignalHistory(hypothesis.templateId);
  const currentHeader = logLines.length > 0 ? parseSessionHeader(logLines) : undefined;
  const historyMd = buildHistoryMarkdown({
    sessions: history.sessions,
    totalSessionCount: history.totalSessionCount,
    currentHeader,
    cleanHeader: opts.cleanHeader,
  });
  if (historyMd) { out.push('', historyMd); }

  return out.join('\n');
}

/**
 * Append evidence lines with asymmetric context: 10 lines before,
 * 10 lines after + extension through stack trace frames (up to 30 extra).
 * Matches the HTML panel's evidence rendering.
 */
function appendEvidenceMarkdown(
  out: string[],
  evidenceLineIds: readonly number[],
  logLines: readonly string[],
  wsRoot: string | undefined,
): void {
  if (evidenceLineIds.length === 0 || logLines.length === 0) { return; }
  out.push('## Evidence', '');
  const contextBefore = 10;
  const contextAfter = 10;
  const maxStackExtend = 30;
  for (const idx of evidenceLineIds) {
    if (idx < 0 || idx >= logLines.length) { continue; }
    const raw = logLines[idx];
    const resolved = wsRoot ? resolveSourcePaths(raw, wsRoot) : raw;
    out.push(`### Line ${idx + 1}`, '');
    out.push(`\`${resolved}\``, '');
    // Timeline position — where in the session this error occurred
    out.push(`> ${describeTimelinePosition(idx, logLines.length)}`);
    // Preceding action — what was happening before this error
    const action = findPrecedingAction(logLines, idx);
    if (action) {
      const resolvedAction = wsRoot ? resolveSourcePaths(action, wsRoot) : action;
      out.push(`> Preceding action: \`${resolvedAction}\``);
    }
    out.push('');
    const start = Math.max(0, idx - contextBefore);
    let end = Math.min(logLines.length - 1, idx + contextAfter);
    // Extend past stack trace frames that follow the target line
    while (end < logLines.length - 1 && end < idx + maxStackExtend) {
      if (!isStackTraceLine(logLines[end + 1])) { break; }
      end++;
    }
    out.push('```');
    for (let i = start; i <= end; i++) {
      const marker = i === idx ? ' >>>' : '    ';
      const line = wsRoot ? resolveSourcePaths(logLines[i], wsRoot) : logLines[i];
      out.push(`${String(i + 1).padStart(6)}${marker} ${line}`);
    }
    out.push('```', '');
  }
}

/** Check if a line looks like a stack trace frame (Dart, Java, or generic). */
function isStackTraceLine(line: string): boolean {
  const t = line.trimStart();
  // Dart/Flutter: #0  main (package:app/main.dart:42)
  if (/^#\d+\s/.test(t)) { return true; }
  // Java/Kotlin: at com.example.Class.method(File.java:42)
  if (/^at\s+\S/.test(t)) { return true; }
  // Indented continuation (tab + method reference)
  if (line.startsWith('\t') && /\.\w+\(/.test(line)) { return true; }
  return false;
}

/**
 * Append related items as markdown. Errors are grouped by fingerprint with
 * category, origin, and normalized-key metadata. Other types use flat lists.
 */
function appendRelatedMarkdown(
  out: string[],
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  logLines: readonly string[],
): void {
  const key = hypothesis.hypothesisKey;

  if (key.startsWith('err::') && bundle.errors) {
    appendGroupedErrorsMarkdown(out, bundle.errors, logLines);
    return;
  }

  const items: { lineIndex: number; text: string }[] = [];
  if (key.startsWith('net::') && bundle.networkFailures) {
    for (const f of bundle.networkFailures) {
      if (!f) { continue; }
      items.push({ lineIndex: f.lineIndex, text: resolveText(logLines, f.lineIndex, f.excerpt) });
    }
  } else if (key.startsWith('warn::') && bundle.warningGroups) {
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

/**
 * Group errors by fingerprint and render each group with category, origin,
 * and normalized fingerprint key (items 2, 6, 8, 12 in the signal report improvements).
 */
function appendGroupedErrorsMarkdown(
  out: string[],
  errors: readonly (RootCauseHintError | undefined)[],
  logLines: readonly string[],
): void {
  // Build fingerprint groups
  const groups = new Map<string, {
    excerpt: string;
    category: string | undefined;
    items: { lineIndex: number; excerpt: string }[];
  }>();
  for (const e of errors) {
    if (!e) { continue; }
    const ex = (e.excerpt || '').trim();
    const fp = e.fingerprint ?? hashFingerprint(normalizeLine(ex));
    const g = groups.get(fp);
    if (g) {
      g.items.push({ lineIndex: e.lineIndex, excerpt: e.excerpt });
    } else {
      groups.set(fp, { excerpt: ex, category: e.category, items: [{ lineIndex: e.lineIndex, excerpt: e.excerpt }] });
    }
  }
  if (groups.size === 0) { return; }

  out.push('## Related Lines', '');
  const maxPerGroup = 10;
  for (const [, g] of groups) {
    // Group heading with badges
    const badges: string[] = [];
    if (g.category) { badges.push(`[${g.category}]`); }
    // Origin classification from first occurrence
    const first = g.items[0];
    if (first && logLines.length > 0) {
      const origin = classifyErrorOrigin(
        resolveText(logLines, first.lineIndex, first.excerpt),
        logLines,
        first.lineIndex,
      );
      if (origin !== 'unknown') { badges.push(`[${origin}]`); }
    }
    const badgeStr = badges.length > 0 ? ` ${badges.join(' ')}` : '';
    out.push(`### ${g.items.length} occurrence(s): ${g.excerpt}${badgeStr}`, '');
    // Fingerprint transparency
    const fpNote = buildFingerprintNote(g.excerpt);
    if (fpNote) { out.push(`*${fpNote}*`, ''); }
    // Occurrence lines
    for (const item of g.items.slice(0, maxPerGroup)) {
      out.push(`- **Line ${item.lineIndex + 1}:** ${resolveText(logLines, item.lineIndex, item.excerpt)}`);
    }
    if (g.items.length > maxPerGroup) {
      out.push(`- ...and ${g.items.length - maxPerGroup} more`);
    }
    out.push('');
  }
}
