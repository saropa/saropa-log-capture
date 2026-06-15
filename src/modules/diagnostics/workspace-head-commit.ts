/**
 * Resolves the workspace's current Git commit (HEAD) by reading `.git` directly — no git process
 * spawned. This is the trust anchor for cross-tool correlation: a sibling mirror captured at a
 * different commit describes an older state of the code, so surfacing it as current would mislead.
 * Knowing HEAD lets the suite mark such a mirror stale rather than trusting it.
 *
 * The parsing is pure (see `workspace-head-commit-parse.ts`, unit-tested); this reader is best-effort
 * and returns `undefined` on any failure — a missing `.git`, a worktree/submodule where `.git` is a
 * file, or an unreadable ref — so a consumer never guesses staleness when the commit is unknown.
 */

import * as vscode from 'vscode';
import { parseHeadRef, findPackedRef, isObjectId } from './workspace-head-commit-parse';

/** Read a file as UTF-8 text, or undefined when it cannot be read. */
async function readTextOrUndefined(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Resolve the current HEAD commit sha for a workspace folder, or undefined when it cannot be
 * determined. Follows: detached HEAD → the object id directly; symbolic ref → the loose ref file,
 * then `.git/packed-refs`. Never throws.
 */
export async function readWorkspaceHeadCommit(rootUri: vscode.Uri): Promise<string | undefined> {
  const gitDir = vscode.Uri.joinPath(rootUri, '.git');
  const headText = await readTextOrUndefined(vscode.Uri.joinPath(gitDir, 'HEAD'));
  if (!headText) {
    return undefined;
  }
  const head = parseHeadRef(headText);
  if (head.sha) {
    return head.sha;
  }
  if (!head.ref) {
    return undefined;
  }
  // Loose ref file (e.g. .git/refs/heads/main) wins; packed-refs is the fallback for packed branches.
  const loose = await readTextOrUndefined(vscode.Uri.joinPath(gitDir, ...head.ref.split('/')));
  if (loose && isObjectId(loose.trim())) {
    return loose.trim();
  }
  const packed = await readTextOrUndefined(vscode.Uri.joinPath(gitDir, 'packed-refs'));
  return packed ? findPackedRef(packed, head.ref) : undefined;
}
