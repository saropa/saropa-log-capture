/**
 * Pure baseline-selection logic for plan 035 (compare current log to a Git baseline).
 *
 * Kept free of the VS Code API so the "which stored session represents this commit"
 * decision is unit-testable without a workspace. The I/O wrapper lives in
 * `git-baseline.ts`.
 */

/** A stored session considered as a Git baseline. */
export interface BaselineCandidate {
  /**
   * Relative key / filename of the session. Saropa log filenames are
   * timestamp-prefixed (`YYYYMMDD_HHMMSS_…`), so a lexical sort on this key orders
   * oldest→newest — the property `pickBaselineKey` relies on to break ties.
   */
  readonly key: string;
  /** Commit SHA recorded on the session (short or full), if any. */
  readonly commit: string | undefined;
}

/** Git's minimum unambiguous short-hash length; shorter prefixes are too collision-prone to trust. */
const MIN_PREFIX = 7;

/**
 * True when two hashes refer to the same commit. The session may store a short
 * SHA (git provider writes `rev-parse --short HEAD`) while the resolved ref is the
 * full 40-char hash, so a match is "either is a prefix of the other", guarded by a
 * minimum length so a 1–2 char fragment cannot match everything.
 */
export function commitsMatch(a: string, b: string): boolean {
  const lo = a.toLowerCase();
  const hi = b.toLowerCase();
  const shorter = lo.length <= hi.length ? lo : hi;
  const longer = lo.length <= hi.length ? hi : lo;
  if (shorter.length < MIN_PREFIX) {
    return false;
  }
  return longer.startsWith(shorter);
}

/**
 * Pick the key of the session whose recorded commit matches `sha`. When several
 * match, return the lexically greatest key — the most recent capture at that
 * commit (plan 035: "prefer most recent if multiple match"). Returns `undefined`
 * when nothing matches.
 */
export function pickBaselineKey(
  candidates: readonly BaselineCandidate[],
  sha: string,
): string | undefined {
  let best: string | undefined;
  for (const c of candidates) {
    if (!c.commit || !commitsMatch(c.commit, sha)) {
      continue;
    }
    if (best === undefined || c.key > best) {
      best = c.key;
    }
  }
  return best;
}
