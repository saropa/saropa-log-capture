/**
 * Public deep-link command surface for the Saropa suite integration (R4).
 *
 * These two command ids are the documented, never-renamed entry points a sibling
 * extension's envelope `fix.command` targets to jump INTO Log Capture (the reciprocal
 * of Drift Advisor's `driftViewer.*` and Saropa Lints' `saropaLints.*` ids). Treat any
 * rename or arg-shape change as a breaking change to the cross-tool protocol.
 *
 * Both are hidden from the command palette (package.json `menus.commandPalette`,
 * `when: false`) because they require arguments — they are invoked programmatically,
 * not typed by a user.
 */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { normalizeDriftSqlFingerprintSql } from './modules/db/drift-sql-fingerprint-normalize';

/** Arg for `saropaLogCapture.openSignal` — the diagnostic id, `${kind}:${fingerprint}`. */
interface OpenSignalArg {
  readonly id?: string;
}

/** Arg for `saropaLogCapture.openSqlHistoryForFingerprint` — pass either form. */
interface OpenSqlHistoryArg {
  readonly sql?: string;
  readonly fingerprint?: string;
}

/**
 * Strip the `kind:` namespace a Log Capture diagnostic id carries (e.g. `sql:SELECT …`
 * or `error:ab12cd`) back to the raw fingerprint the webview rows are keyed on. Ids
 * without a recognizable prefix are returned unchanged so an already-raw value still works.
 */
function fingerprintFromSignalId(id: string): string {
  const sep = id.indexOf(':');
  return sep > 0 ? id.slice(sep + 1) : id;
}

/**
 * Reveal the Log Viewer's Signal panel and scroll to one signal. Mirrors the
 * `showSignals` focus-then-wait dance: the WebviewView resolves asynchronously after
 * `focus`, so posting immediately would hit an empty view set and be dropped.
 */
async function openSignal(deps: CommandDeps, arg: OpenSignalArg | undefined): Promise<void> {
  await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
  for (let i = 0; i < 20 && !deps.viewerProvider.getView(); i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  const focusFingerprint = arg?.id ? fingerprintFromSignalId(arg.id) : undefined;
  deps.viewerProvider.postMessage({ type: 'openSignalPanel', tab: 'recurring', focusFingerprint });
}

/**
 * Open the SQL Query History panel focused on a specific query. Accepts a precomputed
 * `fingerprint` or raw `sql` (normalized here with the same fingerprinter the panel
 * uses, so a sibling tool that only has the literal query still lands on the right row).
 */
function openSqlHistoryForFingerprint(deps: CommandDeps, arg: OpenSqlHistoryArg | undefined): void {
  const fingerprint = arg?.fingerprint
    ?? (arg?.sql ? normalizeDriftSqlFingerprintSql(arg.sql) : undefined);
  deps.broadcaster.postToWebview({ type: 'openSqlQueryHistoryPanel', focusFingerprint: fingerprint });
}

/** Register the suite deep-link commands. */
export function suiteIntegrationCommands(deps: CommandDeps): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(
      'saropaLogCapture.openSignal',
      (arg?: OpenSignalArg) => openSignal(deps, arg),
    ),
    vscode.commands.registerCommand(
      'saropaLogCapture.openSqlHistoryForFingerprint',
      (arg?: OpenSqlHistoryArg) => openSqlHistoryForFingerprint(deps, arg),
    ),
  ];
}
