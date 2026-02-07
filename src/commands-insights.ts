/** Command registration for cross-session insights. */

import * as vscode from 'vscode';
import { showInsightsPanel } from './ui/insights-panel';

/** Register cross-session insights commands. */
export function insightsCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showInsights',
            () => { showInsightsPanel().catch(() => {}); },
        ),
    ];
}
