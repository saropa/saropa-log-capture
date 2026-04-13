/**
 * Shared text utilities for hypothesis builders.
 * Extracted to avoid duplication between build-hypotheses.ts and build-hypotheses-general.ts.
 */

/** Collapse whitespace and truncate to max length with trailing ellipsis. */
export function truncateText(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) { return t; }
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}
