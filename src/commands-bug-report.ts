/** Command registration for bug report generation. */

import * as vscode from 'vscode';
import { t } from './l10n';

/** Register bug report commands. */
export function bugReportCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.generateReport', () => {
            vscode.window.showInformationMessage(
                t('msg.rightClickForBugReport'),
            );
        }),
    ];
}
