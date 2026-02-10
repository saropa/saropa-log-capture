/** Command registration for bug report generation. */

import * as vscode from 'vscode';

/** Register bug report commands. */
export function bugReportCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.generateReport', () => {
            vscode.window.showInformationMessage(
                'Right-click an error line in the log viewer to generate a bug report.',
            );
        }),
    ];
}
