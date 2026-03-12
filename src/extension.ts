/**
 * Extension entry point for Saropa Log Capture.
 *
 * Activates the sidebar log viewer, session history, capture pipeline, integrations,
 * and all commands. Registers webview providers, URI handler, and config listeners.
 */

import * as vscode from 'vscode';
import { setExtensionLogger } from './modules/misc/extension-logger';
import { setGlobalProjectIndexer } from './modules/project-indexer/project-indexer';
import { runActivation, ActivationRefs } from './extension-activation';
import { disposeComparisonPanel } from './ui/session/session-comparison';
import { disposeAnalysisPanel } from './ui/analysis/analysis-panel';
import { disposeInsightsPanel } from './ui/insights/insights-panel';
import { disposeBugReportPanel } from './ui/panels/bug-report-panel';
import { disposeTimelinePanel } from './ui/panels/timeline-panel';
import { t } from './l10n';
import type { SaropaLogCaptureApi } from './api-types';

/** Refs returned by runActivation; used in deactivate to stop sessions, dispose API, indexer and pop-out. */
let activationRefs: ActivationRefs | null = null;

export function activate(context: vscode.ExtensionContext): SaropaLogCaptureApi {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    setExtensionLogger(outputChannel);

    // Detect Cursor IDE and warn about DAP capture limitations
    if (vscode.env.appName === 'Cursor') {
        outputChannel.appendLine('[WARNING] Running in Cursor IDE. Debug output capture may not work correctly.');
        outputChannel.appendLine('Cursor may not fully implement the Debug Adapter Tracker API used for log capture.');
        outputChannel.appendLine('For full functionality, consider using VS Code for debug sessions.');
        showCursorWarning(context);
    }

    activationRefs = runActivation(context, outputChannel);
    return activationRefs.api;
}

const CURSOR_WARNING_KEY = 'slc.cursorWarningShown';

async function showCursorWarning(context: vscode.ExtensionContext): Promise<void> {
    const alreadyShown = context.globalState.get<boolean>(CURSOR_WARNING_KEY);
    if (alreadyShown) { return; }

    const learnMore = t('action.learnMore');
    const dontShow = t('action.dontShowAgain');
    const choice = await vscode.window.showWarningMessage(
        t('msg.cursorIdeWarning'),
        learnMore,
        dontShow,
    );

    if (choice === dontShow) {
        await context.globalState.update(CURSOR_WARNING_KEY, true);
    } else if (choice === learnMore) {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/saropa/saropa-log-capture/issues')).then(undefined, () => {});
    }
}

export function deactivate(): void {
    if (activationRefs) {
        // Dispose API listeners before stopping sessions (removes event bridges cleanly).
        activationRefs.disposeApi();
        // Stop all log sessions first, then dispose indexer and pop-out (order matters for cleanup).
        activationRefs.sessionManager?.stopAll();
        activationRefs.projectIndexer?.dispose();
        activationRefs.projectIndexer = null;
        setGlobalProjectIndexer(null);
        activationRefs.popOutPanel?.dispose();
        activationRefs = null;
    }
    // Dispose editor panels that are not tied to activationRefs.
    disposeComparisonPanel();
    disposeAnalysisPanel();
    disposeInsightsPanel();
    disposeBugReportPanel();
    disposeTimelinePanel();
}
