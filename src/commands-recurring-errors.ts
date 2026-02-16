/** Command registration for Recurring Errors panel. */

import * as vscode from 'vscode';
import { showRecurringErrorsPanel, refreshRecurringErrorsPanel } from './ui/recurring-errors-panel';

/** Register recurring errors commands. */
export function recurringErrorsCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showRecurringErrors',
            () => { showRecurringErrorsPanel().catch(() => {}); },
        ),
        vscode.commands.registerCommand(
            'saropaLogCapture.refreshRecurringErrors',
            () => { refreshRecurringErrorsPanel().catch(() => {}); },
        ),
    ];
}
