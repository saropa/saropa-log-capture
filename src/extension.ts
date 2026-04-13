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
import { disposeInsightTabPanel } from './ui/viewer-panels/insight-tab-panel';
import { disposeBugReportPanel } from './ui/panels/bug-report-panel';
import { disposeTimelinePanel } from './ui/panels/timeline-panel';
import { disposeSignalReportPanel } from './ui/signals/signal-report-panel';
import type { SaropaLogCaptureApi } from './api-types';

/** Refs returned by runActivation; used in deactivate to stop sessions, dispose API, indexer and pop-out. */
let activationRefs: ActivationRefs | null = null;

export function activate(context: vscode.ExtensionContext): SaropaLogCaptureApi {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    setExtensionLogger(outputChannel);

    activationRefs = runActivation(context, outputChannel);
    return activationRefs.api;
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
    disposeInsightTabPanel();
    disposeBugReportPanel();
    disposeTimelinePanel();
    disposeSignalReportPanel();
}
