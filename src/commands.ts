/**
 * Command registration for the Saropa Log Capture extension.
 * Groups: session lifecycle (start/stop, marker, pause), session actions (open, trash, export),
 * history browse/edit, export, comparison, correlation, insights, bug report, timeline, trash,
 * investigation, tools.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { CommandDeps } from './commands-deps';
import { scanForCorrelationTags } from './modules/analysis/correlation-scanner';
import { comparisonCommands } from './commands-comparison';
import { insightsCommands } from './commands-insights';
import { bugReportCommands } from './commands-bug-report';
import { timelineCommands } from './commands-timeline';
import { trashCommands } from './commands-trash';
import { sessionLifecycleCommands, sessionActionCommands, historyBrowseCommands, historyEditCommands } from './commands-session';
import { exportCommands } from './commands-export';
import { toolCommands } from './commands-tools';
import { registerInvestigationCommands } from './commands-investigation';

export type { CommandDeps } from './commands-deps';

/** Register all extension commands. Called from extension-activation after handler wiring. */
export function registerCommands(deps: CommandDeps): void {
    const { context, investigationStore } = deps;
    context.subscriptions.push(
        ...sessionLifecycleCommands(deps),
        ...sessionActionCommands(deps),
        ...historyBrowseCommands(deps),
        ...historyEditCommands(deps),
        ...exportCommands(deps),
        ...comparisonCommands(context.extensionUri),
        ...correlationCommands(deps),
        ...insightsCommands(),
        ...bugReportCommands(),
        ...timelineCommands(),
        ...trashCommands(deps.historyProvider, () => deps.viewerProvider.getCurrentFileUri()),
        ...registerInvestigationCommands({ context, investigationStore, historyProvider: deps.historyProvider }),
        ...toolCommands(deps),
    );
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
