/**
 * Session-context analysis for signal reports.
 *
 * Pure functions that extract metadata from raw log lines: session timing,
 * session outcome (clean stop vs crash), preceding user action, error origin
 * classification (framework vs app), and session header parsing.
 */

import { normalizeLine } from '../../modules/analysis/error-fingerprint-pure';

// --- Session timing ---

export interface SessionTiming {
  /** ISO timestamp from the session header. */
  readonly startIso: string;
  /** ISO timestamp from the session footer (if present). */
  readonly endIso?: string;
  /** Session duration in milliseconds (only set when both start and end are available). */
  readonly durationMs?: number;
}

const headerDateRe = /^Date:\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/;
const footerRe = /^=== SESSION END — ([\d\-T:.Z]+) — (\d+) lines ===/;

/** Parse session start/end timestamps from log lines. */
export function parseSessionTiming(logLines: readonly string[]): SessionTiming | undefined {
  let startIso: string | undefined;
  // Session header is near the top — scan first 60 lines
  const headerScanLimit = Math.min(60, logLines.length);
  for (let i = 0; i < headerScanLimit; i++) {
    const m = headerDateRe.exec(logLines[i].trim());
    if (m) { startIso = m[1]; break; }
  }
  if (!startIso) { return undefined; }

  // Session footer is near the bottom — scan last 10 lines
  let endIso: string | undefined;
  const footerStart = Math.max(0, logLines.length - 10);
  for (let i = logLines.length - 1; i >= footerStart; i--) {
    const m = footerRe.exec(logLines[i].trim());
    if (m) { endIso = m[1]; break; }
  }

  let durationMs: number | undefined;
  if (startIso && endIso) {
    const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (diff > 0) { durationMs = diff; }
  }
  return { startIso, endIso, durationMs };
}

// --- Session outcome ---

export type SessionOutcome = 'clean-stop' | 'no-footer';

/** Detect whether the session ended cleanly (footer present) or was interrupted. */
export function detectSessionOutcome(logLines: readonly string[]): SessionOutcome {
  const footerStart = Math.max(0, logLines.length - 10);
  for (let i = logLines.length - 1; i >= footerStart; i--) {
    if (footerRe.test(logLines[i].trim())) { return 'clean-stop'; }
  }
  return 'no-footer';
}

// --- Timeline position ---

/**
 * Describe where an error line sits in the session timeline.
 * Returns a string like "Line 25 of 59 (42%, early in session)".
 */
export function describeTimelinePosition(lineIndex: number, totalLines: number): string {
  const pct = Math.round(((lineIndex + 1) / totalLines) * 100);
  const region = pct <= 15 ? 'startup' : pct <= 40 ? 'early' : pct <= 70 ? 'mid-session' : 'late';
  return `Line ${lineIndex + 1} of ${totalLines} (${pct}%, ${region})`;
}

// --- Preceding action ---

/**
 * Regex patterns for lines that indicate a user-initiated action or lifecycle event.
 * These are scanned backwards from an error line to provide "what was happening" context.
 */
const actionPatterns: readonly RegExp[] = [
  /^\[[\d:.]+\]\s+\[(stdout|stderr)\]/,   // Timestamped log output start
  /^flutter:\s/,                            // Flutter print
  /^Launching\s/i,                          // App launch
  /^Running\s/i,                            // Build/test run
  /^Restarted\s/i,                          // Hot restart
  /^Reloaded\s/i,                           // Hot reload
  /^Connected\s/i,                          // Device connect
  /^Installing\s/i,                         // APK/IPA install
  /^Building\s/i,                           // Build step
  /^Performing hot/i,                       // Hot reload/restart
  /^Syncing files/i,                        // File sync
];

/**
 * Scan backwards from errorLineIndex to find the most recent user action.
 * Returns the action line text, or undefined if none found within 50 lines.
 */
export function findPrecedingAction(
  logLines: readonly string[],
  errorLineIndex: number,
): string | undefined {
  const scanLimit = 50;
  const stop = Math.max(0, errorLineIndex - scanLimit);
  for (let i = errorLineIndex - 1; i >= stop; i--) {
    const line = logLines[i].trim();
    if (!line) { continue; }
    for (const pat of actionPatterns) {
      if (pat.test(line)) { return line; }
    }
  }
  return undefined;
}

// --- Error origin classification ---

export type ErrorOrigin = 'framework' | 'app' | 'config-dump' | 'unknown';

/**
 * Classify whether an error line is from framework code, app code, or a
 * config/launch dump. Helps the developer decide if this is their bug.
 */
export function classifyErrorOrigin(
  line: string,
  logLines: readonly string[],
  lineIndex: number,
): ErrorOrigin {
  // Check if the line sits inside the session header config dump
  if (isInsideConfigDump(logLines, lineIndex)) { return 'config-dump'; }
  const trimmed = line.trim();
  // Logcat framework prefixes (e.g. "E/MediaCodec:", "W/System.err:")
  if (/^[VDIWEFA]\/\S+:/.test(trimmed)) { return 'framework'; }
  // Flutter framework frames
  if (/^package:flutter\//.test(trimmed)) { return 'framework'; }
  // Dart SDK frames
  if (/^dart:/.test(trimmed)) { return 'framework'; }
  // Java/Android framework
  if (/^at\s+(android\.|com\.android\.|java\.|javax\.|dalvik\.)/.test(trimmed)) { return 'framework'; }
  // App code: Flutter app package or general stack frames
  if (/^package:[^/]+\//.test(trimmed)) { return 'app'; }
  if (/^at\s+\S/.test(trimmed)) { return 'app'; }
  return 'unknown';
}

/** Check if lineIndex falls between SESSION START and the closing === line. */
function isInsideConfigDump(logLines: readonly string[], lineIndex: number): boolean {
  // Scan backwards for the session header marker
  for (let i = lineIndex; i >= Math.max(0, lineIndex - 80); i--) {
    const t = logLines[i].trim();
    if (t === '==========================================') {
      // We hit the END of the header block — lineIndex is past it
      return false;
    }
    if (t.startsWith('=== SAROPA LOG CAPTURE')) { return true; }
  }
  return false;
}

// --- Session header parsing ---

export interface SessionHeader {
  readonly extensionVersion?: string;
  readonly debugAdapter?: string;
  readonly configurationName?: string;
  readonly vscodeVersion?: string;
  readonly os?: string;
  readonly gitBranch?: string;
  readonly gitCommit?: string;
}

/** Parse key metadata from the session header. */
export function parseSessionHeader(logLines: readonly string[]): SessionHeader {
  const result: Record<string, string> = {};
  const limit = Math.min(60, logLines.length);
  for (let i = 0; i < limit; i++) {
    const line = logLines[i].trim();
    // Stop at end of header
    if (line === '==========================================') { break; }
    matchHeader(result, line, 'extensionVersion', /^Extension version:\s+(.+)/);
    matchHeader(result, line, 'debugAdapter', /^Debug Adapter:\s+(.+)/);
    matchHeader(result, line, 'configurationName', /^launch\.json:\s+(.+)/);
    matchHeader(result, line, 'vscodeVersion', /^VS Code:\s+(.+)/);
    matchHeader(result, line, 'os', /^OS:\s+(.+)/);
    matchHeader(result, line, 'gitBranch', /^Git Branch:\s+(.+)/);
    matchHeader(result, line, 'gitCommit', /^Git Commit:\s+(.+)/);
  }
  return result as unknown as SessionHeader;
}

function matchHeader(out: Record<string, string>, line: string, key: string, re: RegExp): void {
  const m = re.exec(line);
  if (m) { out[key] = m[1].trim(); }
}

// --- Fingerprint transparency ---

/**
 * Show the normalized form of an error line alongside the raw text,
 * so the user can see what the fingerprinting grouped together.
 */
export function buildFingerprintNote(rawExcerpt: string): string {
  const normalized = normalizeLine(rawExcerpt);
  // Only show if normalization actually changed something meaningful
  if (normalized === rawExcerpt.trim()) { return ''; }
  return `Fingerprint key: \`${normalized}\``;
}
