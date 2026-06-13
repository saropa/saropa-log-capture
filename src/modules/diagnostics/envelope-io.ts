/**
 * File I/O for the offline diagnostic mirrors under `<workspace>/.saropa/diagnostics/`.
 * The shared contract that lets the three suite tools correlate without a running server
 * (Advisor's API is debug-only, Lints is compile-time, Log Capture runs whenever the
 * editor is open — rarely all live at once). See the envelope module for the schema.
 *
 * All reads are failure-tolerant: an absent or malformed sibling file yields `undefined`,
 * never a thrown error into the host (plan Regression requirement).
 */

import * as vscode from 'vscode';
import {
  type DiagnosticEnvelope,
  type DiagnosticSource,
  DIAGNOSTICS_DIR_SEGMENTS,
  ENVELOPE_FILENAMES,
} from './saropa-diagnostic-envelope';
import { parseEnvelope } from './envelope-parse';

/** The `.saropa/diagnostics/` directory in the first workspace folder, or undefined. */
function getDiagnosticsDirUri(): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  return vscode.Uri.joinPath(folder.uri, ...DIAGNOSTICS_DIR_SEGMENTS);
}

/** The offline-mirror file URI for one producing tool, or undefined when no workspace. */
export function getEnvelopeUri(source: DiagnosticSource): vscode.Uri | undefined {
  const dir = getDiagnosticsDirUri();
  if (!dir) {
    return undefined;
  }
  return vscode.Uri.joinPath(dir, ENVELOPE_FILENAMES[source]);
}

/**
 * Read and validate a sibling tool's offline mirror. Returns `undefined` when the file
 * is absent, unreadable, malformed, or declares an unsupported schema major — callers
 * then show their existing empty/error state rather than a broken row.
 */
export async function readSiblingEnvelope(source: DiagnosticSource): Promise<DiagnosticEnvelope | undefined> {
  const uri = getEnvelopeUri(source);
  if (!uri) {
    return undefined;
  }
  try {
    const data = await vscode.workspace.fs.readFile(uri);
    return parseEnvelope(Buffer.from(data).toString('utf-8'));
  } catch {
    // Absent file is the common case (sibling tool not in use); not an error worth logging.
    return undefined;
  }
}

/**
 * Write Log Capture's envelope to `.saropa/diagnostics/log-capture.json`, creating the
 * directory if needed. Pretty-printed (2-space) so the file is human-diffable in review.
 * Returns false when there is no workspace folder to write into.
 */
export async function writeEnvelope(source: DiagnosticSource, envelope: DiagnosticEnvelope): Promise<boolean> {
  const dir = getDiagnosticsDirUri();
  const uri = getEnvelopeUri(source);
  if (!dir || !uri) {
    return false;
  }
  try {
    await vscode.workspace.fs.createDirectory(dir);
  } catch {
    // Directory already exists — createDirectory is not idempotent across all fs providers.
  }
  const content = JSON.stringify(envelope, null, 2);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
  return true;
}
