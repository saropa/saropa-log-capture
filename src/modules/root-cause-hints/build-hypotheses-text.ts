/**
 * Shared text utilities for hypothesis builders.
 * Extracted to avoid duplication between build-hypotheses.ts, build-hypotheses-general.ts,
 * and signal-report-panel.ts.
 */

/** Collapse whitespace and truncate to max length with trailing ellipsis. */
export function truncateText(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) { return t; }
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Stable key from an excerpt: lowercase, collapse whitespace, take the LEADING 80 chars.
 * The leading text carries the distinguishing content (the error/warning message); two distinct
 * messages that merely share a common trailing boilerplate (e.g. "… at MainActivity.java:142")
 * must not collapse to one hypothesis, which taking the last 80 chars would have done.
 */
export function excerptKey(excerpt: string): string {
  return excerpt.replace(/\s+/g, ' ').trim().slice(0, 80).toLowerCase();
}
