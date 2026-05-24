/** Command registration for the App Quality Insights dashboard. */

import * as vscode from 'vscode';
import { showAppQualityInsights } from './ui/panels/app-quality-insights-panel';

/** Register the App Quality Insights dashboard command. */
export function appQualityCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.openAppQualityInsights',
            (issueId?: unknown) => showAppQualityInsights(typeof issueId === 'string' ? issueId : undefined),
        ),
    ];
}
