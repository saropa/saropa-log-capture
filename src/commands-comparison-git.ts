/** Compare the current log to a Git-commit baseline (plan 035). */

import * as vscode from 'vscode';
import { t } from './l10n';
import { getLogDirectoryUri } from './modules/config/config';
import { resolveGitRef } from './modules/git/git-rev-resolve';
import { resolveBaselineForCommit } from './modules/compare/git-baseline';
import { SessionMetadataStore } from './modules/session/session-metadata';
import { getComparisonPanel } from './ui/session/session-comparison';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';

/** Dependencies for the Git-baseline comparison commands. */
export interface ComparisonGitDeps {
  readonly extensionUri: vscode.Uri;
  readonly broadcaster: ViewerBroadcaster;
  /** Resolves the log currently shown in the viewer (the comparison's "B" side). */
  readonly getFileUri: () => vscode.Uri | undefined;
}

/**
 * Resolve `ref` to a baseline log, then open it against the current log in the
 * existing session comparison panel. Every failure path surfaces a specific
 * message — the plan forbids silently substituting a wrong baseline.
 */
async function compareToRef(ref: string, deps: ComparisonGitDeps): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const currentUri = deps.getFileUri();
  if (!folder || !currentUri) {
    vscode.window.showWarningMessage(t('msg.gitCompareNoCurrentLog'));
    return;
  }

  const sha = await resolveGitRef(ref, folder.uri.fsPath);
  if (!sha) {
    vscode.window.showWarningMessage(t('msg.gitCompareBadRef', ref));
    return;
  }

  const logDir = getLogDirectoryUri(folder);
  const result = await resolveBaselineForCommit({
    sha,
    currentUri,
    logDir,
    store: new SessionMetadataStore(),
  });
  if (!result.uri) {
    vscode.window.showWarningMessage(t('msg.gitCompareNoBaseline', ref));
    return;
  }

  // Baseline first, current second — matches the "A vs B" order of compareSessions.
  await getComparisonPanel(deps.extensionUri, deps.broadcaster).compare(result.uri, currentUri);
}

/** Register the two Git-baseline comparison commands. */
export function comparisonGitCommands(deps: ComparisonGitDeps): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(
      'saropaLogCapture.compareLogToPreviousCommit',
      () => compareToRef('HEAD~1', deps),
    ),
    vscode.commands.registerCommand(
      'saropaLogCapture.compareLogToCommit',
      async () => {
        const ref = await vscode.window.showInputBox({
          title: t('title.compareToCommit'),
          prompt: t('prompt.compareToCommit'),
          placeHolder: 'HEAD~1',
        });
        if (ref && ref.trim()) {
          await compareToRef(ref.trim(), deps);
        }
      },
    ),
  ];
}
