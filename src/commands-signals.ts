/** Command registration for cross-session signals. Retargets to the unified Signal panel in the viewer. */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { openSignalTab } from './ui/viewer-panels/signal-tab-panel';
import { ensureWebviewReady, ensureWebviewReadyOrWarn } from './commands-webview-ready';

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
                // set and be silently dropped (the dead-button bug, bug_015). ensureWebviewReadyOrWarn
                // focuses + polls for resolution and surfaces a warning if it never resolves.
                if (!(await ensureWebviewReadyOrWarn(deps.viewerProvider))) { return; }
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
            async () => {
                // Fired 3s after every capture finishes (session-lifecycle-finalize.ts) with
                // no user action guaranteeing the view is open. Uses the silent
                // `ensureWebviewReady()` (not the "…OrWarn" variant) because this is an
                // automatic background refresh, not a user click — popping a warning
                // toast every time a capture ends with the viewer closed would violate
                // the "signals stay passive" UX rule. If the view never resolves, the
                // refresh is simply skipped (bug_015).
                if (!(await ensureWebviewReady(deps.viewerProvider))) { return; }
                deps.viewerProvider.postMessage({ type: 'signalRefreshRecurring' });
            },
        ),
    ];
}
