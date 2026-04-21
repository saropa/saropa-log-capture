/**
 * Command registration for the Saropa Log Capture extension.
 * Groups: session lifecycle (start/stop, marker, pause), session actions (open, trash, export),
 * history browse/edit, export, comparison, correlation, signals, bug report, timeline, trash,
 * collection, tools.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { CommandDeps } from './commands-deps';
import { scanForCorrelationTags } from './modules/analysis/correlation-scanner';
import { comparisonCommands } from './commands-comparison';
import { signalsCommands } from './commands-signals';
import { bugReportCommands } from './commands-bug-report';
import { qualityCommands } from './commands-quality';
import { timelineCommands } from './commands-timeline';
import { trashCommands } from './commands-trash';
import { sessionLifecycleCommands, sessionActionCommands, historyBrowseCommands, historyEditCommands } from './commands-session';
import { exportCommands } from './commands-export';
import { toolCommands } from './commands-tools';
import { registerCollectionCommands } from './commands-collection';
import { externalLogsCommands } from './commands-external-logs';
import { learningCommands } from './commands-learning';
import { sessionGroupCommands } from './commands-session-groups';
import type { CaptureToggleStatusBar } from './ui/shared/capture-toggle-status-bar';

export type { CommandDeps } from './commands-deps';

/** Register all extension commands. Called from extension-activation after handler wiring. */
export function registerCommands(deps: CommandDeps, captureToggle: CaptureToggleStatusBar): void {
    const { context, collectionStore } = deps;
    context.subscriptions.push(
        ...sessionLifecycleCommands(deps, captureToggle),
        ...sessionActionCommands(deps),
        ...historyBrowseCommands(deps),
        ...historyEditCommands(deps),
        ...exportCommands(deps),
        ...comparisonCommands(context.extensionUri, deps.broadcaster),
        ...correlationCommands(deps),
        ...signalsCommands(deps),
        ...bugReportCommands({ getFileUri: () => deps.viewerProvider.getCurrentFileUri(), context }),
        ...qualityCommands({ getFileUri: () => deps.viewerProvider.getCurrentFileUri() }),
        ...timelineCommands(),
        ...trashCommands(deps.historyProvider, () => deps.viewerProvider.getCurrentFileUri()),
        ...registerCollectionCommands({ context, collectionStore, historyProvider: deps.historyProvider, viewerProvider: deps.viewerProvider }),
        ...toolCommands(deps),
        ...externalLogsCommands(deps),
        ...learningCommands(deps),
        ...sessionGroupCommands(deps.historyProvider, deps.viewerProvider),
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

function correlationCommands(deps: CommandDeps): vscode.Disposable[] {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.rescanTags', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            const tags = await scanForCorrelationTags(item.uri);
            await historyProvider.getMetaStore().setCorrelationTags(item.uri, tags);
            historyProvider.refresh();
            vscode.window.showInformationMessage(
            t('msg.foundCorrelationTags', String(tags.length), tags.length !== 1 ? 's' : ''),
        );
        }),
    ];
}
