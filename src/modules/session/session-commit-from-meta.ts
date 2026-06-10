/**
 * Extract the commit a session was captured at, from its integration payloads.
 *
 * Plan 035 baseline matching needs ONE normalizer so callers never reach into
 * `SessionMeta.integrations` (a `Record<string, unknown>`) with ad-hoc casts.
 * When the integrations contract changes, only this file moves.
 */

/**
 * Provider payload keys that may carry a commit, in preference order.
 *
 * `git` records HEAD at capture time (the most direct signal — see
 * providers/git-source-code.ts, which stores `rev-parse --short HEAD`). `buildCi`
 * carries the CI head SHA as a fallback for sessions captured from a built
 * artifact rather than a live checkout.
 */
const COMMIT_SOURCES: readonly string[] = ['git', 'buildCi'];

/** Read a non-empty `commit` string off one wrapped integration payload. */
function readCommit(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const commit = (payload as Record<string, unknown>).commit;
  return typeof commit === 'string' && commit.trim() !== '' ? commit.trim() : undefined;
}

/**
 * Returns the commit SHA recorded on a session (may be short or full, depending
 * on which provider wrote it), or `undefined` when none is present.
 */
export function getSessionCommit(
  integrations: Record<string, unknown> | undefined,
): string | undefined {
  if (!integrations) {
    return undefined;
  }
  for (const key of COMMIT_SOURCES) {
    const commit = readCommit(integrations[key]);
    if (commit) {
      return commit;
    }
  }
  return undefined;
}
