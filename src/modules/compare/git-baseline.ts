/**
 * Resolve a baseline log URI for a Git commit (plan 035).
 *
 * A commit is a *label* for which stored session to load, not `git show <ref>:path`
 * — most Saropa logs live only under the log directory and are never in Git. We
 * therefore index sessions by the commit recorded in their metadata and pick the
 * most recent match. No silent wrong baseline: a miss returns `uri: undefined`
 * plus a reason so the command can show an actionable error instead of comparing
 * against an arbitrary "previous" file.
 */

import * as vscode from 'vscode';
import { getConfig, readTrackedFiles } from '../config/config';
import type { SessionMetadataStore } from '../session/session-metadata';
import { relativeKey } from '../session/session-metadata-io';
import { getSessionCommit } from '../session/session-commit-from-meta';
import { pickBaselineKey, type BaselineCandidate } from './baseline-match';

/** Inputs for one baseline resolution. Bundled to stay within the 4-param limit. */
export interface BaselineResolveOptions {
  /** Full SHA from `resolveGitRef`. */
  readonly sha: string;
  /** The session being compared; excluded so a log never compares against itself. */
  readonly currentUri: vscode.Uri | undefined;
  /** Log directory to scan for candidate sessions. */
  readonly logDir: vscode.Uri;
  /** Central metadata store (batched read; no per-file opens). */
  readonly store: SessionMetadataStore;
}

/** Outcome of resolution. `reason` is a stable id for messaging/telemetry. */
export interface BaselineResult {
  readonly uri?: vscode.Uri;
  /** `matched` | `no-sessions` | `no-commit-match`. */
  readonly reason: string;
}

/** Build commit-tagged candidates from tracked files, skipping the current session. */
async function buildCandidates(opts: BaselineResolveOptions): Promise<BaselineCandidate[]> {
  const { fileTypes, includeSubfolders } = getConfig();
  const rels = await readTrackedFiles(opts.logDir, fileTypes, includeSubfolders);
  const meta = await opts.store.loadAllMetadata(opts.logDir);
  const currentPath = opts.currentUri?.fsPath;
  const out: BaselineCandidate[] = [];
  for (const rel of rels) {
    const uri = vscode.Uri.joinPath(opts.logDir, rel);
    if (currentPath && uri.fsPath === currentPath) {
      continue;
    }
    // `rels` are logDir-relative (timestamp-prefixed, so usable for ordering),
    // but the metadata store keys on the workspace-relative path — look up by that.
    const session = meta.get(relativeKey(uri));
    out.push({ key: rel, commit: getSessionCommit(session?.integrations) });
  }
  return out;
}

/**
 * Find the stored session that represents `opts.sha`. Reads the central metadata
 * store once (not N per-file opens) per the plan's performance note.
 */
export async function resolveBaselineForCommit(
  opts: BaselineResolveOptions,
): Promise<BaselineResult> {
  const candidates = await buildCandidates(opts);
  if (candidates.length === 0) {
    return { reason: 'no-sessions' };
  }
  const key = pickBaselineKey(candidates, opts.sha);
  if (!key) {
    return { reason: 'no-commit-match' };
  }
  return { uri: vscode.Uri.joinPath(opts.logDir, key), reason: 'matched' };
}
