/**
 * External-change reload helpers for the log viewer (plan 039b).
 *
 * Extracted from `log-viewer-provider.ts` to keep that file under the line limit. These back the
 * `requestExternalReload` / `notifyExternalDelete` methods the tail watcher calls when the open log
 * is rewritten/truncated or deleted on disk by another process.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { getConfig } from "../../modules/config/config";

/** Last path segment of a URI for user-facing messages; falls back to the full fsPath. */
function basenameOf(uri: vscode.Uri): string {
  return uri.path.split("/").pop() || uri.fsPath;
}

/**
 * Reload `uri` after an external rewrite/truncate, honoring `reloadOnExternalChange` (the escape
 * hatch) and the optional confirm prompt. No-op if the user has since switched to another log.
 *
 * @param currentUri the log currently shown — guards against reloading a log the user navigated away from.
 * @param reload performs the actual clear + re-read + re-tail (the provider's `loadFromFile(uri, {tail})`).
 */
export async function reloadOnExternalChange(
  currentUri: vscode.Uri | undefined,
  uri: vscode.Uri,
  reload: (uri: vscode.Uri) => Promise<void>,
): Promise<void> {
  if (currentUri?.fsPath !== uri.fsPath) {
    return;
  }
  const cfg = getConfig();
  if (!cfg.reloadOnExternalChange) {
    return;
  }
  if (cfg.reloadPromptOnExternalChange) {
    const yes = t("action.reload");
    const pick = await vscode.window.showInformationMessage(
      t("msg.logChangedOnDisk", basenameOf(uri)), yes, t("action.ignore"),
    );
    if (pick !== yes) {
      return;
    }
  }
  await reload(uri);
}

/** Warn that the open log was deleted on disk; the caller keeps the last loaded snapshot. */
export function warnExternalDelete(uri: vscode.Uri): void {
  vscode.window.showWarningMessage(t("msg.logDeletedOnDisk", basenameOf(uri)));
}
