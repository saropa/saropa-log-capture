/** Command registration for bug report generation. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { createBugReportFile } from './modules/bug-report/report-file-writer';

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
    ];
}
