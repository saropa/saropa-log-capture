/**
 * Produce Log Capture's offline diagnostic mirror (R1). On session end (and on demand)
 * this serializes the current signals into the Saropa Diagnostic Envelope and writes
 * `<workspace>/.saropa/diagnostics/log-capture.json` — the file the sibling tools (Drift
 * Advisor, Saropa Lints) read to correlate without Log Capture's webview being open.
 *
 * Best-effort: a failure here must never disrupt session finalization, so the caller
 * runs this fire-and-forget with its own `.catch` to the output channel.
 */

import * as vscode from 'vscode';
import { aggregateSignals } from '../misc/cross-session-aggregator';
import { buildEnvelope, signalsToDiagnostics } from './signal-to-diagnostic';
import { writeEnvelope } from './envelope-io';
import { LOG_CAPTURE_SOURCE } from './saropa-diagnostic-envelope';

/** Full extension id (`publisher.name`) used to read our own version at runtime. */
const EXTENSION_ID = 'saropa.saropa-log-capture';

/** Producer `name` field — matches the package name the siblings expect. */
const PRODUCER_NAME = 'saropa-log-capture';

/** Read this extension's version from its manifest, or a safe placeholder if unavailable. */
function getProducerVersion(): string {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  const version = ext?.packageJSON?.version;
  return typeof version === 'string' ? version : '0.0.0';
}

/** Options for a single produce pass. */
export interface ProduceOptions {
  /** HEAD at capture time, stamped on every diagnostic for cross-commit correlation. */
  readonly commitSha?: string;
  /** ISO 8601 generation time. Injected (not read from the clock here) so callers can fix it in tests. */
  readonly generatedAt: string;
}

/**
 * Build the envelope from the current cross-session signals and write the mirror.
 * Returns true when a file was written, false when there is no workspace folder. Throws
 * only on an unexpected fs write failure — the caller decides how to log it.
 */
export async function writeLogCaptureDiagnostics(opts: ProduceOptions): Promise<boolean> {
  // `aggregateSignals('all')` is the same source the recurring-signals notification and the
  // Signal panel use — the mirror reflects exactly what Log Capture would show the user.
  const aggregated = await aggregateSignals('all').catch(() => undefined);
  const signals = aggregated?.allSignals ?? [];
  const diagnostics = signalsToDiagnostics(signals, { commitSha: opts.commitSha });
  const envelope = buildEnvelope(
    diagnostics,
    { name: PRODUCER_NAME, version: getProducerVersion() },
    opts.generatedAt,
  );
  return writeEnvelope(LOG_CAPTURE_SOURCE, envelope);
}
