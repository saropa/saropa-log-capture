/**
 * Deep-link OUT to the sibling suite extensions (R5). Lets a slow-query or DB row in the
 * Log Viewer jump straight into Drift Advisor's EXPLAIN or Saropa Lints' rule view.
 *
 * Two safety rules govern this module:
 *  1. **Never show a dead action.** A button is offered only when its target command is
 *     actually registered right now ({@link getSuiteDeepLinkAvailability} checks the live
 *     command list, not just whether the extension is installed — that also survives a
 *     sibling that is installed but on an older version without the command yet).
 *  2. **Never run an arbitrary command the webview names.** The executor only dispatches
 *     ids on the allowlist below, so a compromised/buggy webview message cannot invoke
 *     `workbench.action.*` or anything else.
 *
 * The command ids are the canonical cross-tool surface (Drift Advisor plan, Section 3).
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

/** Canonical sibling deep-link command ids. Stable public API — never invent new ones here. */
export const SIBLING_DEEPLINK_COMMANDS = {
  /** Drift Advisor: open the EXPLAIN tree + index suggestion for a query. Args: `{ sql, table? }`. */
  driftExplainForSql: 'driftViewer.openExplainForSql',
  /** Drift Advisor: open a table's live data grid. Args: `{ table }`. */
  driftOpenTable: 'driftViewer.openTable',
  /** Saropa Lints: open the rule's explanation. Args: `{ ruleId }`. */
  lintsExplainRule: 'saropaLints.explainRule',
  /** Saropa Lints: enable a rule. Args: `{ ruleId }`. */
  lintsEnableRule: 'saropaLints.enableRule',
} as const;

/** Which sibling deep-link commands are dispatchable right now. */
export interface SuiteDeepLinkAvailability {
  readonly explainSql: boolean;
  readonly openTable: boolean;
  readonly explainRule: boolean;
  readonly enableRule: boolean;
}

/**
 * Probe the live command registry for each sibling command. `getCommands(true)` includes
 * commands contributed by other extensions; a missing id means the button must stay hidden.
 */
export async function getSuiteDeepLinkAvailability(): Promise<SuiteDeepLinkAvailability> {
  const all = new Set(await vscode.commands.getCommands(true));
  return {
    explainSql: all.has(SIBLING_DEEPLINK_COMMANDS.driftExplainForSql),
    openTable: all.has(SIBLING_DEEPLINK_COMMANDS.driftOpenTable),
    explainRule: all.has(SIBLING_DEEPLINK_COMMANDS.lintsExplainRule),
    enableRule: all.has(SIBLING_DEEPLINK_COMMANDS.lintsEnableRule),
  };
}

/** The only command ids the webview is permitted to ask the host to execute. */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set<string>(Object.values(SIBLING_DEEPLINK_COMMANDS));

/**
 * Execute a sibling deep-link command on behalf of a webview click. Rejects ids outside
 * the allowlist silently (defense in depth) and surfaces a real failure as a toast rather
 * than a silent no-op — e.g. the command vanished between the availability probe and the
 * click (sibling disabled mid-session).
 */
export async function runSiblingDeepLink(command: string, args: unknown): Promise<void> {
  if (!ALLOWED_COMMANDS.has(command)) {
    return;
  }
  try {
    await vscode.commands.executeCommand(command, args);
  } catch {
    // Toast (not silent) so a tap that does nothing is explained — the sibling tool may be
    // out of date or was disabled after the button was rendered.
    void vscode.window.showWarningMessage(t('msg.suiteDeepLinkFailed', command));
  }
}
