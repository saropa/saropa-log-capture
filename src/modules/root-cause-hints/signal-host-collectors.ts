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

/* bug_030 (sub-issue 3): the cache used to key ONLY on file URI, cleared solely on
   `sessionId` change. A log file grows continuously during a live session (same URI
   the whole time), so once the initial bundle was cached, an ANR appearing 5 minutes
   later was never picked up — the cache returned the stale (often `undefined`) result
   until the session was reopened. Adding the file's byte size to the cache key means
   any growth (or truncation) of the file invalidates the cache on the next check,
   without needing a session-reset hook to fire correctly. */
let cachedAnrCacheKey: string | undefined;
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
  cachedAnrCacheKey = undefined;
  cachedAnrResult = undefined;
}

/** Run ANR risk scoring on the current log file, cached per URI + byte size. */
async function collectAnrRisk(fileUri: vscode.Uri | undefined): Promise<SignalAnrRisk | undefined> {
  if (!fileUri) { return undefined; }
  const uriStr = fileUri.toString();
  try {
    /* stat() is a cheap metadata read (no file content) — use the size to decide
       whether the cached scan is still valid before paying for a full readFile(). */
    const stat = await vscode.workspace.fs.stat(fileUri);
    const cacheKey = `${uriStr}|${stat.size}`;
    if (cachedAnrCacheKey === cacheKey) { return cachedAnrResult; }

    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const result = scanAnrRisk(text);
    cachedAnrCacheKey = cacheKey;
    cachedAnrResult = result.score >= ROOT_CAUSE_ANR_MIN_SCORE
      ? { score: result.score, level: result.level, signals: result.signals }
      : undefined;
    return cachedAnrResult;
  } catch {
    return undefined;
  }
}
