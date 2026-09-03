/** Command registration for bug report generation. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { createBugReportFile } from './modules/bug-report/report-file-writer';
/* bug_009 (Fixed): the GitHub Issue and Handoff variant commands (exportGitHubIssue,
   copyHandoffBundle) were removed from the command palette because their formatters
   read sessionInfo/fullOutput fields that the variant runner always hardcoded to empty
   — the variants shipped with the log body and session info missing. The unused
   report-variant-runner.ts / report-file-variants.ts modules (no live callers, no
   tests) were deleted rather than kept as dead scaffolding; a future fix should
   rebuild the variant formatters against collectBugReportData() from scratch, wired
   through the existing createBugReportFile() data flow. Only the working Markdown
   report (createReportFile) stays exposed. */

/** Callbacks needed by bug report commands. */
export interface BugReportCommandDeps {
    readonly getFileUri: () => vscode.Uri | undefined;
    readonly context: vscode.ExtensionContext;
}

/** Register bug report commands. */
export function bugReportCommands(deps: BugReportCommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.generateReport', () => {
            vscode.window.showInformationMessage(
                t('msg.rightClickForBugReport'),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.createReportFile', () => {
            const fileUri = deps.getFileUri();
            if (!fileUri) {
                vscode.window.showInformationMessage(t('msg.noActiveSession'));
                return;
            }
            createBugReportFile({
                selectedText: '',
                selectedLineStart: 0,
                selectedLineEnd: 0,
                sessionInfo: {},
                fullDecoratedOutput: '',
                fullOutputLineCount: 0,
                fileUri,
                errorText: '',
                lineIndex: 0,
                extensionContext: deps.context,
            }).catch(() => {});
        }),
        /* E3/E4 (plan 052): GitHub-issue and Handoff-bundle variant commands intentionally
           NOT registered here — see bug_009. Re-add once report-variant-runner.ts populates
           sessionInfo/fullOutput/fullOutputLineCount from collected data instead of hardcoding
           them to empty. */
    ];
}
