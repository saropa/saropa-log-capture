/**
 * Impure reader for suite connection status — resolves each sibling's installed state and on-disk
 * mirror, then defers to the pure {@link classifySibling} for the state decision. Kept separate from
 * the classifier so the state machine stays unit-testable without vscode (see
 * `suite-connection-classify.ts`).
 */

import * as vscode from 'vscode';
import { DRIFT_ADVISOR_EXTENSION_ID } from '../integrations/drift-advisor-constants';
import { SAROPA_LINTS_EXTENSION_ID } from '../misc/saropa-lints-api';
import { readSiblingEnvelope } from './envelope-io';
import { type DiagnosticSource } from './saropa-diagnostic-envelope';
import {
  classifySibling,
  type MirrorSnapshot,
  type SiblingConnection,
  type SiblingTool,
} from './suite-connection-classify';

export {
  type SiblingConnection,
  type SiblingTool,
  type ConnectionState,
  type SilentCause,
} from './suite-connection-classify';

/** Extension id per tool — installation is the user's opt-in signal that they want that lens. */
const EXTENSION_ID: Readonly<Record<SiblingTool, string>> = {
  advisor: DRIFT_ADVISOR_EXTENSION_ID,
  lints: SAROPA_LINTS_EXTENSION_ID,
};

/** Mirror filename source per tool. */
const MIRROR_SOURCE: Readonly<Record<SiblingTool, DiagnosticSource>> = {
  advisor: 'advisor',
  lints: 'lints',
};

/** Turn a parsed envelope into the pure snapshot the classifier needs. */
function snapshotFromEnvelope(
  envelope: Awaited<ReturnType<typeof readSiblingEnvelope>>,
): MirrorSnapshot | undefined {
  if (!envelope) {
    return undefined;
  }
  return {
    findingCount: envelope.diagnostics.length,
    // Commit is uniform within one mirror; take the first diagnostic that carries it.
    capturedCommit: envelope.diagnostics.find((d) => d.commitSha)?.commitSha,
    generatedAt: envelope.generatedAt,
  };
}

/** Read one sibling's installed state + mirror and classify it. Never throws. */
export async function readSiblingConnection(
  tool: SiblingTool,
  currentCommit?: string,
): Promise<SiblingConnection> {
  const installed = vscode.extensions.getExtension(EXTENSION_ID[tool]) !== undefined;
  if (!installed) {
    return classifySibling(tool, false, undefined, currentCommit);
  }
  const envelope = await readSiblingEnvelope(MIRROR_SOURCE[tool]);
  return classifySibling(tool, true, snapshotFromEnvelope(envelope), currentCommit);
}

/** Read both siblings' connection status concurrently. */
export async function readSuiteConnections(currentCommit?: string): Promise<SiblingConnection[]> {
  return Promise.all([
    readSiblingConnection('advisor', currentCommit),
    readSiblingConnection('lints', currentCommit),
  ]);
}
