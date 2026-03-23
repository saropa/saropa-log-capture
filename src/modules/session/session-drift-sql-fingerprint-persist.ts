/**
 * Persist Drift SQL fingerprint summary into session metadata at finalize (plan **DB_10**).
 */

import * as vscode from "vscode";
import { scanSaropaLogDatabaseFingerprints } from "../db/db-session-fingerprint-diff";
import {
  summaryMapToPersistedV1,
  trimSummaryForPersistence,
} from "../db/drift-sql-fingerprint-summary-persist";
import type { SessionMetadataStore } from "./session-metadata";

/** Scan log UTF-8 and write `driftSqlFingerprintSummary` v1 (bounded key count). */
export async function scanAndPersistDriftSqlFingerprintSummary(
  logUri: vscode.Uri,
  metadataStore: SessionMetadataStore,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  try {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString("utf-8");
    const { summary, firstLineByFingerprint } = scanSaropaLogDatabaseFingerprints(text);
    if (summary.size === 0) {
      return;
    }
    const trimmed = trimSummaryForPersistence(summary, firstLineByFingerprint);
    const persisted = summaryMapToPersistedV1(trimmed.summary, trimmed.firstLineByFingerprint);
    await metadataStore.setDriftSqlFingerprintSummary(logUri, persisted);
    outputChannel.appendLine(`Drift SQL fingerprints: ${trimmed.summary.size} patterns (persisted)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    outputChannel.appendLine(`Failed to scan Drift SQL fingerprints: ${msg}`);
  }
}
