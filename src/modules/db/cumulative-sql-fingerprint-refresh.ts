/**
 * Host-side trigger for refreshing the webview's cumulative SQL fingerprint baseline (plan **DB_17 Step 1**).
 *
 * Reads every sidebar log's metadata via `loadFilteredMetas('all')`, aggregates persisted
 * `driftSqlFingerprintSummary` entries (excluding the active log to prevent double-counting against
 * the live webview rollup), and posts the result via `ViewerBroadcaster.setCumulativeSqlFingerprintSummary`.
 *
 * Fire-and-forget by design: failures log to the output channel but never block log loading or
 * session finalize. Sorted newest-first so cross-log jumps land on recent occurrences.
 */

import * as vscode from "vscode";
import { getLogDirectoryUri } from "../config/config";
import { loadFilteredMetas, parseSessionDate, type LoadedMeta } from "../session/metadata-loader";
import {
  aggregateCumulativeSqlFingerprints,
  type MetaUriResolver,
} from "./cumulative-sql-fingerprint-aggregator";

/** Minimal broadcaster surface this helper depends on (so tests can pass a fake). */
export interface CumulativeSqlBroadcaster {
  setCumulativeSqlFingerprintSummary(
    payload: ReturnType<typeof aggregateCumulativeSqlFingerprints> | null,
  ): void;
}

/** Build a resolver that joins relative metadata filenames back to absolute log URI strings. */
function buildResolver(logDir: vscode.Uri): MetaUriResolver {
  return {
    resolveLogUriString(filename: string): string {
      return vscode.Uri.joinPath(logDir, filename).toString();
    },
  };
}

/** Sort newest-first so the first log to contribute a fingerprint is the most recent occurrence. */
function sortedNewestFirst(metas: readonly LoadedMeta[]): readonly LoadedMeta[] {
  return [...metas].sort((a, b) => parseSessionDate(b.filename) - parseSessionDate(a.filename));
}

/**
 * Read all sidebar metadata, aggregate Drift SQL fingerprint summaries (excluding `activeUri`),
 * and post the payload to the webview. Pass `null` payload when no log contributes anything so
 * the webview can clear its cumulative map and hide the toggle.
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
    const metas = sortedNewestFirst(await loadFilteredMetas("all"));
    const payload = aggregateCumulativeSqlFingerprints(
      metas,
      buildResolver(logDir),
      activeUri?.toString(),
    );
    /* Empty fingerprint map → null payload so webview hides the toggle entirely. */
    if (Object.keys(payload.fingerprints).length === 0 && payload.contributingLogCount === 0) {
      broadcaster.setCumulativeSqlFingerprintSummary(null);
      return;
    }
    broadcaster.setCumulativeSqlFingerprintSummary(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    outputChannel?.appendLine(`Cumulative SQL fingerprint refresh failed: ${msg}`);
  }
}
