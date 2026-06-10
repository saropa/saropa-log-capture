/**
 * Host-side trigger for refreshing the webview's cumulative SQL fingerprint baseline (plan **DB_18**).
 *
 * Reads the persisted `.saropa/cumulative-sql-index.json` (ONE file) instead of re-scanning every
 * sidebar log's metadata on each log-load (DB_17's O(N-files) hot path). The index is kept current
 * incrementally at each session finalize; this refresh only rebuilds it on the cold path
 * (missing / corrupt / a contributing log was deleted). The active log's own contribution is
 * subtracted before broadcasting so the live webview rollup is not double-counted.
 *
 * Fire-and-forget by design: failures log to the output channel but never block log loading.
 */

import * as vscode from "vscode";
import { getLogDirectoryUri } from "../config/config";
import {
  loadFilteredMetas,
  listMetaFiles,
  parseSessionDate,
  type LoadedMeta,
} from "../session/metadata-loader";
import { SessionMetadataStore } from "../session/session-metadata";
import { aggregateCumulativeSqlFingerprints } from "./cumulative-sql-fingerprint-aggregator";
import {
  isPersistedDriftSqlFingerprintSummaryV1,
  type PersistedDriftSqlFingerprintSummaryV1,
} from "./drift-sql-fingerprint-summary-persist";
import {
  buildCumulativeSqlFingerprintIndex,
  indexToPayloadExcludingActive,
  type CumulativeSqlFingerprintIndexV1,
} from "./cumulative-sql-fingerprint-index";
import {
  readCumulativeSqlFingerprintIndex,
  relativeLogPath,
  writeCumulativeSqlFingerprintIndex,
} from "./cumulative-sql-fingerprint-index-store";

/** Minimal broadcaster surface this helper depends on (so tests can pass a fake). */
export interface CumulativeSqlBroadcaster {
  setCumulativeSqlFingerprintSummary(
    payload: ReturnType<typeof aggregateCumulativeSqlFingerprints> | null,
  ): void;
}

/** Sort newest-first so the first log to contribute a fingerprint is the most recent occurrence. */
function sortedNewestFirst(metas: readonly LoadedMeta[]): readonly LoadedMeta[] {
  return [...metas].sort((a, b) => parseSessionDate(b.filename) - parseSessionDate(a.filename));
}

/**
 * Fresh when every contributing log still exists on disk. New logs enter via the finalize hook, so
 * a larger file count (logs without DB output) does NOT force a rebuild — only a deletion does.
 */
function isIndexFresh(index: CumulativeSqlFingerprintIndexV1, files: readonly string[]): boolean {
  const fileSet = new Set(files);
  return index.contributingLogs.every((f) => fileSet.has(f));
}

/** Read the index; rebuild once from all metadata when missing / corrupt / stale, then persist. */
async function loadOrRebuildIndex(
  logDir: vscode.Uri,
  files: readonly string[],
): Promise<CumulativeSqlFingerprintIndexV1> {
  const existing = await readCumulativeSqlFingerprintIndex(logDir);
  if (existing && isIndexFresh(existing, files)) {
    return existing;
  }
  const metas = sortedNewestFirst(await loadFilteredMetas("all"));
  const rebuilt = buildCumulativeSqlFingerprintIndex(metas, {
    resolveLogUriString: (filename) => vscode.Uri.joinPath(logDir, filename).toString(),
  });
  await writeCumulativeSqlFingerprintIndex(logDir, rebuilt).catch(() => undefined);
  return rebuilt;
}

/** The active log's relative filename within the log dir (matches the index's contributingLogs). */
function activeFilenameFor(
  logDir: vscode.Uri,
  activeUri: vscode.Uri | undefined,
): string | undefined {
  return activeUri ? relativeLogPath(logDir, activeUri) : undefined;
}

/** Read just the active log's persisted summary (one metadata read) to subtract from the index. */
async function readActiveSummary(
  activeUri: vscode.Uri | undefined,
): Promise<PersistedDriftSqlFingerprintSummaryV1 | undefined> {
  if (!activeUri) {
    return undefined;
  }
  try {
    const meta = await new SessionMetadataStore().loadMetadata(activeUri);
    const summary = meta.driftSqlFingerprintSummary;
    return summary && isPersistedDriftSqlFingerprintSummaryV1(summary) ? summary : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read the index, exclude `activeUri`'s contribution, and post the payload to the webview. Posts
 * `null` when nothing contributes so the webview clears its cumulative map and hides the filter.
 */
export async function refreshCumulativeSqlFingerprintBaseline(
  broadcaster: CumulativeSqlBroadcaster,
  activeUri: vscode.Uri | undefined,
  outputChannel?: vscode.OutputChannel,
): Promise<void> {
  try {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      broadcaster.setCumulativeSqlFingerprintSummary(null);
      return;
    }
    const logDir = getLogDirectoryUri(folder);
    const files = await listMetaFiles(logDir);
    const index = await loadOrRebuildIndex(logDir, files);
    const activeSummary = await readActiveSummary(activeUri);
    const payload = indexToPayloadExcludingActive(
      index,
      activeFilenameFor(logDir, activeUri),
      activeSummary,
      files.length,
    );
    const empty = Object.keys(payload.fingerprints).length === 0 && payload.contributingLogCount === 0;
    broadcaster.setCumulativeSqlFingerprintSummary(empty ? null : payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    outputChannel?.appendLine(`Cumulative SQL fingerprint refresh failed: ${msg}`);
  }
}
