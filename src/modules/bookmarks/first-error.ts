/**
 * First-error detection for smart bookmarks.
 * Scans log content lines in order and returns the first line classified as error
 * (and optionally warning), using the same level classification as the viewer.
 */

import { classifyLevel, type SeverityLevel } from '../analysis/level-classifier';

const MAX_SNIPPET_LEN = 80;

/**
 * Extract category and plain message from a raw log file line.
 * Format must stay in sync with viewer-file-loader parseFileLine (same [time] [category] rest patterns).
 */
function extractCategoryAndPlain(raw: string): { category: string; plainText: string } {
  if (/^---\s*(MARKER:|MAX LINES)/.test(raw) || /^===\s*(SESSION END|SPLIT)/.test(raw)) {
    return { category: 'console', plainText: raw };
  }
  const timeElapsedCat = raw.match(/^\[([\d:.]+)\]\s*\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/);
  if (timeElapsedCat) {
    return { category: timeElapsedCat[3], plainText: timeElapsedCat[4] ?? '' };
  }
  const tsMatch = raw.match(/^\[([\d:.]+)\]\s*\[([\w-]+)\]\s?(.*)$/);
  if (tsMatch) {
    return { category: tsMatch[2], plainText: tsMatch[3] ?? '' };
  }
  const elapsedCat = raw.match(/^\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/);
  if (elapsedCat) {
    return { category: elapsedCat[2], plainText: elapsedCat[3] ?? '' };
  }
  const catMatch = raw.match(/^\[([\w-]+)\]\s?(.*)$/);
  if (catMatch) {
    return { category: catMatch[1], plainText: catMatch[2] ?? '' };
  }
  return { category: 'console', plainText: raw };
}

/** Strip ANSI codes for snippet display. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '').trim();
}

export interface FirstErrorResult {
  readonly lineIndex: number;
  /** Short preview for notification (max 80 chars). */
  readonly snippet: string;
  /** Full plain line text for adding a bookmark. */
  readonly lineText: string;
  readonly level: 'error' | 'warning';
}

export interface FirstErrorOptions {
  /** Use strict error detection (same as viewer levelDetection). */
  readonly strict: boolean;
  /** If true, also find first warning and return it when no error. */
  readonly includeWarning: boolean;
  /** When true, DAP `stderr` category maps to error before text (legacy). Same as `saropaLogCapture.stderrTreatAsError`. */
  readonly stderrTreatAsError: boolean;
}

/**
 * Scan content lines and return the first error (and optionally first warning).
 * Line indices are 0-based content line indices (after header).
 */
export function findFirstErrorLines(
  contentLines: readonly string[],
  options: FirstErrorOptions,
): { firstError?: FirstErrorResult; firstWarning?: FirstErrorResult } {
  let firstError: FirstErrorResult | undefined;
  let firstWarning: FirstErrorResult | undefined;
  const strict = options.strict;

  for (let i = 0; i < contentLines.length; i++) {
    const raw = contentLines[i];
    const { category, plainText } = extractCategoryAndPlain(raw);
    const level: SeverityLevel = classifyLevel(plainText, category, strict, options.stderrTreatAsError);
    const trimmed = stripAnsi(plainText);
    const displaySnippet = trimmed.length > MAX_SNIPPET_LEN ? trimmed.slice(0, MAX_SNIPPET_LEN) + '…' : trimmed;

    if (level === 'error' && !firstError) {
      firstError = { lineIndex: i, snippet: displaySnippet, lineText: trimmed, level: 'error' };
      if (!options.includeWarning) {
        return { firstError, firstWarning };
      }
    }
    if (level === 'warning' && !firstWarning) {
      firstWarning = { lineIndex: i, snippet: displaySnippet, lineText: trimmed, level: 'warning' };
    }
    if (firstError && (firstWarning || !options.includeWarning)) {
      break;
    }
  }

  return { firstError, firstWarning };
}
