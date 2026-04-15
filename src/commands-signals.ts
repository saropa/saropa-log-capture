/** Command registration for cross-session signals. Retargets to the unified Signal panel in the viewer. */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { openSignalTab } from './ui/viewer-panels/signal-tab-panel';

/** Register cross-session signals commands. Opens the viewer's Signal panel (no separate WebviewPanel). */
export function signalsCommands(deps: CommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showSignals',
            () => {
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
