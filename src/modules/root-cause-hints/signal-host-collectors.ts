/**
 * Host-side signal collectors that enrich the webview bundle with data
 * only available on the extension side (file I/O, ANR scoring, etc.).
 *
 * Called after receiving the raw bundle from the webview, before `buildHypotheses`.
 * Results are cached per session to avoid re-reading the log file on every bundle post
 * (which fires on each RAF-coalesced `addLines`).
 */

import * as vscode from 'vscode';
import { scanAnrRisk } from '../analysis/anr-risk-scorer';
import type { RootCauseHintBundle, SignalAnrRisk } from './root-cause-hint-types';
import { ROOT_CAUSE_ANR_MIN_SCORE } from './root-cause-hint-eligibility';

let cachedAnrFileUri: string | undefined;
let cachedAnrResult: SignalAnrRisk | undefined;

/**
 * Enrich the webview-collected bundle with host-side signals.
 * Returns a new bundle with additional fields merged in.
 */
export async function enrichBundleWithHostSignals(
  bundle: RootCauseHintBundle,
  fileUri: vscode.Uri | undefined,
): Promise<RootCauseHintBundle> {
  const anrRisk = await collectAnrRisk(fileUri);
  if (!anrRisk) { return bundle; }
  return { ...bundle, anrRisk };
}

/** Clear cached host signals (call on session reset). */
export function clearHostSignalCache(): void {
  cachedAnrFileUri = undefined;
  cachedAnrResult = undefined;
}

/** Run ANR risk scoring on the current log file, cached per URI. */
async function collectAnrRisk(fileUri: vscode.Uri | undefined): Promise<SignalAnrRisk | undefined> {
  if (!fileUri) { return undefined; }
  const uriStr = fileUri.toString();
  if (cachedAnrFileUri === uriStr) { return cachedAnrResult; }
  try {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const result = scanAnrRisk(text);
    cachedAnrFileUri = uriStr;
    cachedAnrResult = result.score >= ROOT_CAUSE_ANR_MIN_SCORE
      ? { score: result.score, level: result.level, signals: result.signals }
      : undefined;
    return cachedAnrResult;
  } catch {
    return undefined;
  }
}
