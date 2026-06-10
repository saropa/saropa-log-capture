/**
 * Resolve a Git ref (e.g. `HEAD~1`, a tag, a short or full SHA) to its full commit SHA.
 *
 * Plan 035 uses a commit as a *time label* for picking a baseline log, so whatever
 * the user typed must be canonicalized to a stable full hash before it is matched
 * against session metadata. Centralizing this here keeps every caller off ad-hoc
 * `git rev-parse` invocations.
 */

import { runGitCommand } from '../misc/workspace-analyzer';

/**
 * Returns the full 40-char SHA for `ref`, or `undefined` when the ref is unknown,
 * is not a commit, or git is unavailable.
 *
 * `^{commit}` forces commit resolution so an annotated tag dereferences to the
 * commit it points at; `--verify --quiet` makes git fail silently (empty stdout)
 * on a bad ref instead of printing the ref back, which the regex then rejects.
 */
export async function resolveGitRef(ref: string, cwd: string): Promise<string | undefined> {
  const trimmed = ref.trim();
  if (!trimmed) {
    return undefined;
  }

  const out = await runGitCommand(
    ['rev-parse', '--verify', '--quiet', `${trimmed}^{commit}`],
    cwd,
  );

  return /^[0-9a-f]{40}$/.test(out) ? out : undefined;
}
