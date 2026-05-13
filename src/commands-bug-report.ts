/** Command registration for bug report generation. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { createBugReportFile } from './modules/bug-report/report-file-writer';
import { collectAndFormatVariant, type ReportVariant } from './modules/bug-report/report-variant-runner';

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
        /* E3 (plan 052): GitHub-issue preset — variant of the report tailored to GitHub's
           default issue template. Copies markdown to clipboard so the user can paste straight
           into "New issue" without going through file save / open. */
        vscode.commands.registerCommand('saropaLogCapture.exportGitHubIssue', () =>
            runVariantCommand(deps, 'github-issue', 'GitHub issue markdown copied to clipboard'),
        ),
        /* E4 (plan 052): Compact handoff bundle — three-section markdown subset designed for
           paste into Slack/Discord/Teams. Same data path as the full report, different
           formatter. ~30 lines so it fits in a single chat message. */
        vscode.commands.registerCommand('saropaLogCapture.copyHandoffBundle', () =>
            runVariantCommand(deps, 'handoff-bundle', 'Handoff bundle copied to clipboard'),
        ),
    ];
}

async function runVariantCommand(deps: BugReportCommandDeps, variant: ReportVariant, successMsg: string): Promise<void> {
    const fileUri = deps.getFileUri();
    if (!fileUri) {
        vscode.window.showInformationMessage(t('msg.noActiveSession'));
        return;
    }
    try {
        const markdown = await collectAndFormatVariant({
            variant,
            fileUri,
            extensionContext: deps.context,
        });
        await vscode.env.clipboard.writeText(markdown);
        vscode.window.showInformationMessage(successMsg);
    } catch (err) {
        /* Non-critical: failures here just mean the user gets no markdown. Log via channel
           so they aren't silent, but don't surface a modal — the show in the user's logs is
           enough since they triggered the command and will notice nothing happened. */
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showWarningMessage(`Could not build ${variant} markdown: ${msg}`);
    }
}
