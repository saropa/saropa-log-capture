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

/** Stable key from excerpt: lowercase, collapse whitespace, take last 80 chars. */
export function excerptKey(excerpt: string): string {
  return excerpt.replace(/\s+/g, ' ').trim().slice(-80).toLowerCase();
}
