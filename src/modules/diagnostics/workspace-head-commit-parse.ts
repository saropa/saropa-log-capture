/**
 * Pure parsing for the workspace HEAD resolver — no fs, no vscode, so it is unit-tested under
 * `node --test`. The impure reader (`workspace-head-commit.ts`) reads `.git` and uses these.
 */

/** A 40-hex (SHA-1) or 64-hex (SHA-256) Git object id. */
export function isObjectId(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value) || /^[0-9a-f]{64}$/i.test(value);
}

/** Parsed `.git/HEAD`: a symbolic `ref` (e.g. `refs/heads/main`) or a detached `sha`. */
export interface HeadRef {
  readonly ref?: string;
  readonly sha?: string;
}

/** Parse `.git/HEAD`: `ref: refs/heads/<branch>` → a ref; a raw object id → a detached sha. */
export function parseHeadRef(content: string): HeadRef {
  const line = content.trim();
  if (line.startsWith('ref:')) {
    const ref = line.slice('ref:'.length).trim();
    return ref ? { ref } : {};
  }
  return isObjectId(line) ? { sha: line } : {};
}

/** Find a ref's sha in `.git/packed-refs` content. Skips comments, blanks, and peeled-tag `^` lines. */
export function findPackedRef(packed: string, refName: string): string | undefined {
  for (const raw of packed.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('^')) { continue; }
    const space = line.indexOf(' ');
    if (space <= 0) { continue; }
    const sha = line.slice(0, space);
    if (line.slice(space + 1).trim() === refName && isObjectId(sha)) { return sha; }
  }
  return undefined;
}
