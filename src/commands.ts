/**
 * Command registration for the Saropa Log Capture extension.
 * Groups: session lifecycle (start/stop, marker, pause), session actions (open, trash, export),
 * history browse/edit, export, comparison, signals, bug report, trash, collection, tools.
 * (Timeline and correlation-rescan commands were removed in bug_006 — they required a
 * TreeView `viewItem` context that no view ever provided, so they were unreachable.)
 */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { comparisonCommands } from './commands-comparison';
import { comparisonGitCommands } from './commands-comparison-git';
import { signalsCommands } from './commands-signals';
import { bugReportCommands } from './commands-bug-report';
import { flowMapCommands } from './commands-flow-map';
import { qualityCommands } from './commands-quality';
import { trashCommands } from './commands-trash';
import { sessionLifecycleCommands, sessionActionCommands, historyBrowseCommands, historyEditCommands } from './commands-session';
import { exportCommands } from './commands-export';
import { toolCommands } from './commands-tools';
import { registerCollectionCommands } from './commands-collection';
import { externalLogsCommands } from './commands-external-logs';
import { learningCommands } from './commands-learning';
import { sessionGroupCommands } from './commands-session-groups';
import { investigationCommands } from './commands-investigations';
import { InvestigationStore } from './modules/session/investigation-store';
import { suiteIntegrationCommands } from './commands-suite';
import type { CaptureToggleStatusBar } from './ui/shared/capture-toggle-status-bar';

export type { CommandDeps } from './commands-deps';

/** Register all extension commands. Called from extension-activation after handler wiring. */
export function registerCommands(deps: CommandDeps, captureToggle: CaptureToggleStatusBar): void {
    const { context, collectionStore } = deps;
    // Investigation Groups persist in workspaceState; the store is disposable (owns a change event).
    const investigationStore = new InvestigationStore(context.workspaceState);
    context.subscriptions.push(investigationStore);
    context.subscriptions.push(
        ...sessionLifecycleCommands(deps, captureToggle),
        ...sessionActionCommands(deps),
        ...historyBrowseCommands(deps),
        ...historyEditCommands(deps),
        ...exportCommands(deps),
        ...comparisonCommands(context.extensionUri, deps.broadcaster),
        ...comparisonGitCommands({
            extensionUri: context.extensionUri,
            broadcaster: deps.broadcaster,
            getFileUri: () => deps.viewerProvider.getCurrentFileUri(),
        }),
        ...signalsCommands(deps),
        ...bugReportCommands({ getFileUri: () => deps.viewerProvider.getCurrentFileUri(), context }),
        ...flowMapCommands({
            getFileUri: () => deps.viewerProvider.getCurrentFileUri(),
            viewer: deps.viewerProvider,
        }),
        ...qualityCommands({ getFileUri: () => deps.viewerProvider.getCurrentFileUri() }),
        ...trashCommands(deps.historyProvider, () => deps.viewerProvider.getCurrentFileUri()),
        ...registerCollectionCommands({ context, collectionStore, historyProvider: deps.historyProvider, viewerProvider: deps.viewerProvider }),
        ...toolCommands(deps),
        ...externalLogsCommands(deps),
        ...learningCommands(deps),
        ...sessionGroupCommands(deps.historyProvider, deps.viewerProvider, deps.collectionStore),
        ...investigationCommands(investigationStore, deps.historyProvider),
        ...suiteIntegrationCommands(deps),
        walkthroughCommand(),
    );
}

/** Opens the Getting Started walkthrough in VS Code's native walkthrough UI. */
function walkthroughCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('saropaLogCapture.openWalkthrough', () => {
        void vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'saropa.saropa-log-capture#saropaLogCapture.getStarted',
            false,
        );
    });
}
