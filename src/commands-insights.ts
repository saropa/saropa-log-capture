/** Command registration for cross-session insights. Retargets to the unified Insight panel in the viewer. */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { openInsightTab } from './ui/viewer-panels/insight-tab-panel';

/** Register cross-session insights commands. Opens the viewer's Insight panel (no separate WebviewPanel). */
export function insightsCommands(deps: CommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showInsights',
            () => {
                deps.viewerProvider.postMessage({ type: 'openInsight', tab: 'recurring' });
            },
        ),
        vscode.commands.registerCommand(
            'saropaLogCapture.openInsightsInTab',
            () => {
                openInsightTab({
                    getCurrentFileUri: () => deps.viewerProvider.getCurrentFileUri(),
                    context: deps.context,
                    extensionUri: deps.context.extensionUri,
                    version: '',
                });
            },
        ),
        vscode.commands.registerCommand(
            'saropaLogCapture.refreshRecurringErrors',
            () => {
                deps.viewerProvider.postMessage({ type: 'insightRefreshRecurring' });
            },
        ),
    ];
}
