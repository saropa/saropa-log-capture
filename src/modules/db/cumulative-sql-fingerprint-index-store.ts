/**
 * I/O for the persisted cumulative SQL fingerprint index (plan **DB_18**).
 * Pure merge/exclude math lives in `cumulative-sql-fingerprint-index.ts`; this module owns the
 * `vscode.workspace.fs` reads/writes and the session-finalize incremental update.
 */

import * as vscode from "vscode";
import { getLogDirectoryUri } from "../config/config";
import type { PersistedDriftSqlFingerprintSummaryV1 } from "./drift-sql-fingerprint-summary-persist";
import {
  emptyCumulativeSqlFingerprintIndex,
  isCumulativeSqlFingerprintIndexV1,
  mergeSummaryIntoCumulativeSqlFingerprintIndex,
  type CumulativeSqlFingerprintIndexV1,
} from "./cumulative-sql-fingerprint-index";

/** Index file lives under the same `.saropa` dir Drift Advisor uses for its session sidecar. */
const INDEX_SEGMENTS = [".saropa", "cumulative-sql-index.json"] as const;

function indexUri(logDir: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(logDir, ...INDEX_SEGMENTS);
}

/** Relative path of a log within the log directory, matching `listMetaFiles()` filenames. */
export function relativeLogPath(logDir: vscode.Uri, logUri: vscode.Uri): string | undefined {
  const base = logDir.toString().replace(/\/+$/, "") + "/";
  const target = logUri.toString();
  if (!target.startsWith(base)) {
    return undefined;
  }
  return decodeURIComponent(target.slice(base.length));
}

/** Read + validate the index. Returns null on missing / unreadable / wrong schema so callers rebuild. */
export async function readCumulativeSqlFingerprintIndex(
  logDir: vscode.Uri,
): Promise<CumulativeSqlFingerprintIndexV1 | null> {
  try {
    const raw = await vscode.workspace.fs.readFile(indexUri(logDir));
    const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf-8"));
    return isCumulativeSqlFingerprintIndexV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Write the index, creating the `.saropa` directory if absent. */
export async function writeCumulativeSqlFingerprintIndex(
  logDir: vscode.Uri,
  index: CumulativeSqlFingerprintIndexV1,
): Promise<void> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(logDir, INDEX_SEGMENTS[0]));
  await vscode.workspace.fs.writeFile(indexUri(logDir), Buffer.from(JSON.stringify(index), "utf-8"));
}

/**
 * Incrementally fold a just-finalized log's summary into the index (session-finalize hook).
 * Fire-and-forget: failures log but never block finalize. O(index size) once per session end —
 * far cheaper than the per-load O(N-files) rescan it replaces.
 */
export async function updateCumulativeSqlIndexForFinalizedLog(
  logUri: vscode.Uri,
  summary: PersistedDriftSqlFingerprintSummaryV1,
  outputChannel?: vscode.OutputChannel,
): Promise<void> {
  try {
    const folder = vscode.workspace.getWorkspaceFolder(logUri) ?? vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return;
    }
    const logDir = getLogDirectoryUri(folder);
    const filename = relativeLogPath(logDir, logUri);
    if (!filename) {
      return;
    }
    const existing = (await readCumulativeSqlFingerprintIndex(logDir)) ?? emptyCumulativeSqlFingerprintIndex();
    const merged = mergeSummaryIntoCumulativeSqlFingerprintIndex(existing, filename, summary, logUri.toString());
    // Reference-equal return means the merge was a no-op (already indexed / empty) — skip the write.
    if (merged !== existing) {
      await writeCumulativeSqlFingerprintIndex(logDir, merged);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    outputChannel?.appendLine(`Cumulative SQL index update failed: ${msg}`);
  }
}
