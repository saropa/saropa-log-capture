/**
 * First-error detection for smart bookmarks.
 * Scans log content lines in order and returns the first line classified as error
 * (and optionally warning), using the same level classification as the viewer.
 */

import { classifyLevel, type SeverityLevel } from '../analysis/level-classifier';
import { classifyLogLine } from '../analysis/stack-parser';

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
  /** Skip lines before this 0-based index (e.g. first app launch line). */
  readonly skipBeforeLine?: number;
}

/**
 * Scan content lines and return the first error (and optionally first warning).
 * Line indices are 0-based content line indices (after header).
 */
export interface FindFirstErrorResult {
  readonly firstError?: FirstErrorResult;
  readonly firstWarning?: FirstErrorResult;
  /** Number of error-level lines skipped before skipBeforeLine. */
  readonly skippedPreLaunchErrors: number;
}

/**
 * True when the line is Android system/device logcat noise, not the app's own code.
 *
 * Only `device-other` counts as noise. `device-critical` tags (AndroidRuntime,
 * ActivityManager, ART, lowmemorykiller, …) are curated in device-tag-tiers.ts as
 * exactly the device lines that DO signal a real app problem — a FATAL EXCEPTION or
 * an ANR kill is the line the user most wants to jump to, so it must stay a
 * first-class first-error candidate. This mirrors screenshot-capturer.ts, which
 * likewise gates only on `=== 'device-other'`.
 *
 * Pass ANSI-stripped, left-trimmed text: classifyLogLine's logcat and Android
 * system-process regexes are all anchored at `^`, so a leading escape sequence or
 * indent makes every one of them miss.
 */
function isDeviceTierLine(text: string): boolean {
  return classifyLogLine(text) === 'device-other';
}

export function findFirstErrorLines(
  contentLines: readonly string[],
  options: FirstErrorOptions,
): FindFirstErrorResult {
  let firstError: FirstErrorResult | undefined;
  let firstWarning: FirstErrorResult | undefined;
  // Fallbacks: first `device-other` logcat error or warning, used only if the log
  // never has one from the app's own code. Background Android system lines
  // (SurfaceFlinger, libc, GraphicBufferAllocator, ...) routinely carry E/F level
  // prefixes that aren't app faults, so they must not win the "first error" race over
  // a real Dart/Flutter exception that appears later in the log. Device-critical tags
  // are NOT demoted — see isDeviceTierLine.
  let firstDeviceError: FirstErrorResult | undefined;
  let firstDeviceWarning: FirstErrorResult | undefined;
  let skippedPreLaunchErrors = 0;
  const strict = options.strict;

  const start = options.skipBeforeLine && options.skipBeforeLine > 0 ? options.skipBeforeLine : 0;

  // Count errors in the skipped pre-launch region.
  for (let i = 0; i < start; i++) {
    const { category, plainText } = extractCategoryAndPlain(contentLines[i]);
    if (classifyLevel(plainText, category, strict, options.stderrTreatAsError) === 'error') {
      skippedPreLaunchErrors++;
    }
  }

  for (let i = start; i < contentLines.length; i++) {
    const raw = contentLines[i];
    const { category, plainText } = extractCategoryAndPlain(raw);
    const level: SeverityLevel = classifyLevel(plainText, category, strict, options.stderrTreatAsError);
    // Nothing left to learn from this line's severity? Skip before paying for the
    // ANSI strip, the snippet build and classifyLogLine's regex battery — with no
    // app-code error in the log this loop now runs to the last line, so the
    // per-line cost has to stay proportional to what is still unresolved.
    const wantsError = level === 'error' && !firstError;
    const wantsWarning = level === 'warning' && !firstWarning;
    if (!wantsError && !wantsWarning) { continue; }
    const trimmed = stripAnsi(plainText);
    const displaySnippet = trimmed.length > MAX_SNIPPET_LEN ? trimmed.slice(0, MAX_SNIPPET_LEN) + '…' : trimmed;
    const isDevice = isDeviceTierLine(trimmed);
    const candidate: FirstErrorResult = {
      lineIndex: i, snippet: displaySnippet, lineText: trimmed, level: wantsError ? 'error' : 'warning',
    };

    if (wantsError) {
      if (isDevice) {
        firstDeviceError ??= candidate;
      } else {
        firstError = candidate;
      }
    } else {
      if (isDevice) {
        firstDeviceWarning ??= candidate;
      } else {
        firstWarning = candidate;
      }
    }
    if (firstError && (firstWarning || !options.includeWarning)) {
      break;
    }
  }

  return {
    firstError: firstError ?? firstDeviceError,
    firstWarning: firstWarning ?? firstDeviceWarning,
    skippedPreLaunchErrors,
  };
}
