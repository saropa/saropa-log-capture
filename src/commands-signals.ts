/** Command registration for cross-session signals. Retargets to the unified Signal panel in the viewer. */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { openSignalTab } from './ui/viewer-panels/signal-tab-panel';

/** Register cross-session signals commands. Opens the viewer's Signal panel (no separate WebviewPanel). */
export function signalsCommands(deps: CommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showSignals',
            async () => {
                // The Log Viewer is a webview *view* (sidebar/panel), not an editor tab. It is
                // normally closed right after a capture finishes — exactly when the recurring-signal
                // toast's "Open Signals" button fires this. Focus creates/reveals the view, but the
                // WebviewView resolves asynchronously, so posting immediately would hit an empty view
                // set and be silently dropped (the dead-button bug). Wait (≤1s) for a view to resolve.
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                for (let i = 0; i < 20 && !deps.viewerProvider.getView(); i++) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 50));
                }
                deps.viewerProvider.postMessage({ type: 'openSignalPanel', tab: 'recurring' });
            },
        ),
        vscode.commands.registerCommand(
            'saropaLogCapture.openSignalsInTab',
            () => {
                openSignalTab({
                    getCurrentFileUri: () => deps.viewerProvider.getCurrentFileUri(),
                    context: deps.context,
                    extensionUri: deps.context.extensionUri,
                    version: '',
                });
            },
        ),
        vscode.commands.registerCommand(
            'saropaLogCapture.refreshRecurringSignals',
            () => {
                deps.viewerProvider.postMessage({ type: 'signalRefreshRecurring' });
            },
        ),
    ];
}
