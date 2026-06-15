/**
 * "Installed but silent" notice — the user-facing half of the suite front door.
 *
 * When a sibling extension is installed but has not written its `.saropa/diagnostics` mirror, the
 * integration silently shows nothing and the user cannot tell why. This module first tries to make
 * the tool emit (self-wiring: call its refresh command where one exists), and only if it is still
 * silent tells the user, once, with the concrete next action it cannot perform for them.
 *
 * Gated per (tool, cause) in globalState so it never nags; a changed cause re-arms it. Evidence-based
 * by construction: a tool that is not installed is never mentioned, so this only speaks about lenses
 * the user already opted into.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { logExtensionError } from '../misc/extension-logger';
import {
  readSuiteConnections,
  type SiblingConnection,
  type SiblingTool,
} from './suite-connection-status';
import { readWorkspaceHeadCommit } from './workspace-head-commit';

/** Already-localized tool labels (brand names, not translated). */
const TOOL_LABEL: Readonly<Record<SiblingTool, string>> = {
  advisor: 'Saropa Drift Advisor',
  lints: 'Saropa Lints',
};

/**
 * Refresh commands Log Capture may invoke to make a silent tool emit on demand (self-wiring).
 * Only listed where the sibling actually contributes one — Drift Advisor ships
 * `driftViewer.writeDiagnosticsMirror`; Saropa Lints has no manual mirror command yet, so it is
 * absent here and the user is guided instead (tracked as a cross-repo ask in plan 108).
 */
const REFRESH_COMMAND: Partial<Readonly<Record<SiblingTool, string>>> = {
  advisor: 'driftViewer.writeDiagnosticsMirror',
};

/** globalState key for the once-gate, keyed by tool AND cause so a new cause re-notifies. */
function silentNoticeKey(c: SiblingConnection): string {
  return `slc.suiteSilentNotice.${c.tool}.${c.cause ?? 'unknown'}`;
}

/** The localized "installed but silent" message for a tool/cause. */
function silentMessage(c: SiblingConnection): string {
  const label = TOOL_LABEL[c.tool];
  if (c.cause === 'stale') {
    return t('msg.suiteSilentStale', label);
  }
  // noMirror: the tool has shared nothing here yet. Guidance differs per tool's emission trigger.
  return c.tool === 'advisor'
    ? t('msg.suiteSilentAdvisor', label)
    : t('msg.suiteSilentLints', label);
}

/**
 * Try the refresh command for each silent tool that exposes one. Returns true if any ran, so the
 * caller re-reads the connections (the tool may now be emitting). Best-effort: a refresh that
 * throws or whose command is unregistered is skipped, falling through to the guidance notice.
 */
async function tryRefreshSilent(silent: readonly SiblingConnection[]): Promise<boolean> {
  const registered = new Set(await vscode.commands.getCommands(true));
  let ran = false;
  for (const c of silent) {
    const command = REFRESH_COMMAND[c.tool];
    if (command && registered.has(command)) {
      try {
        await vscode.commands.executeCommand(command);
        ran = true;
      } catch {
        // Refresh is best-effort — e.g. Drift Advisor's server is not running, so it cannot write.
      }
    }
  }
  return ran;
}

/** Show the silent notice for one tool at most once per (tool, cause). */
async function notifySilentOnce(context: vscode.ExtensionContext, c: SiblingConnection): Promise<void> {
  const key = silentNoticeKey(c);
  if (context.globalState.get<boolean>(key)) {
    return;
  }
  await context.globalState.update(key, true);
  void vscode.window.showInformationMessage(silentMessage(c));
}

/**
 * Detect installed-but-silent siblings, self-wire what is fixable, and notify (once) about the rest.
 * Safe to call on activation and at session end — returns immediately when no installed sibling is
 * silent. Never throws into the caller.
 */
export async function maybeNotifySilentSiblings(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Resolve HEAD so a mirror captured at a different commit is judged stale, not trusted as current.
    const folder = vscode.workspace.workspaceFolders?.[0];
    const currentCommit = folder ? await readWorkspaceHeadCommit(folder.uri) : undefined;
    let connections = await readSuiteConnections(currentCommit);
    const silent = connections.filter((c) => c.state === 'silent');
    if (silent.length === 0) {
      return;
    }
    // Self-wire first: a tool we can refresh may stop being silent, sparing the user a notice.
    if (await tryRefreshSilent(silent)) {
      connections = await readSuiteConnections(currentCommit);
    }
    for (const c of connections) {
      if (c.state === 'silent') {
        await notifySilentOnce(context, c);
      }
    }
  } catch (error) {
    logExtensionError('suite silent-sibling notice', error instanceof Error ? error : String(error));
  }
}
