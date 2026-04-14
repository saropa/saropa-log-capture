/** Export-related commands (HTML, CSV, JSON, SLC, Loki). */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { CommandDeps } from './commands-deps';
import { getConfig } from './modules/config/config';
import { exportToHtml } from './modules/export/html-export';
import { exportToInteractiveHtml } from './modules/export/html-export-interactive';
import { exportToCsv, exportToJson, exportToJsonl } from './modules/export/export-formats';
import { exportSessionToSlc, importSlcBundle, type ImportSlcResult } from './modules/export/slc-bundle';
import { exportToLoki as doExportToLoki, setLokiBearerToken } from './modules/export/loki-export';
import {
    setBuildCiGithubToken, deleteBuildCiGithubToken,
    setBuildCiAzurePat, deleteBuildCiAzurePat,
    setBuildCiGitlabToken, deleteBuildCiGitlabToken,
} from './modules/integrations/providers/build-ci';
import { exportSignalsSummaryCmd } from './commands-export-insights';
import { htmlExportCmd, fileExportCmd, buildCiTokenCmd, importInvestigationFromSlc } from './commands-export-helpers';

export function exportCommands(deps: CommandDeps): vscode.Disposable[] {
    const { context, viewerProvider, historyProvider, investigationStore } = deps;
    return [
        htmlExportCmd('exportHtml', exportToHtml),
        htmlExportCmd('exportHtmlInteractive', exportToInteractiveHtml),
        fileExportCmd('exportCsv', exportToCsv),
        fileExportCmd('exportJson', exportToJson),
        fileExportCmd('exportJsonl', exportToJsonl),
        exportSignalsSummaryCmd(viewerProvider, investigationStore),
        vscode.commands.registerCommand('saropaLogCapture.exportSlc',
            async (item: { uri: vscode.Uri } | undefined) => {
                const uri = item?.uri ?? viewerProvider.getCurrentFileUri();
                if (!uri) {
                    void vscode.window.showWarningMessage(t('msg.openLogFirst'));
                    return;
                }
                const outUri = await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: t('progress.exportSlc') },
                    () => exportSessionToSlc(uri),
                );
                if (outUri) {
                    const action = await vscode.window.showInformationMessage(
                        t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
                        t('action.open'),
                    );
                    if (action === t('action.open')) { await vscode.window.showTextDocument(outUri); }
                }
            }),
        vscode.commands.registerCommand('saropaLogCapture.importSlc', async () => {
            const uris = await vscode.window.showOpenDialog({
                filters: { [t('filter.slcBundles')]: ['slc'] },
                canSelectMany: true,
                title: t('title.importSlc'),
            });
            if (!uris?.length) { return; }
            let lastResult: ImportSlcResult | undefined;
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: t('progress.importSlc') },
                async () => {
                    for (const uri of uris) {
                        const result = await importSlcBundle(uri);
                        if (result) { lastResult = result; }
                    }
                },
            );
            if (lastResult && 'mainLogUri' in lastResult) {
                historyProvider.refresh();
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(lastResult.mainLogUri);
            } else if (lastResult) {
                await importInvestigationFromSlc(lastResult.investigation, investigationStore, historyProvider);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.exportToLoki',
            async (item: { uri: vscode.Uri } | undefined) => {
                const config = getConfig();
                const loki = config.integrationsLoki;
                if (!loki.enabled || !loki.pushUrl.trim()) {
                    void vscode.window.showWarningMessage(t('msg.lokiNotConfigured'));
                    return;
                }
                const uri = item?.uri ?? viewerProvider.getCurrentFileUri();
                if (!uri) {
                    void vscode.window.showWarningMessage(t('msg.openLogFirst'));
                    return;
                }
                const result = await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: t('progress.exportLoki') },
                    () => doExportToLoki(uri, loki, context, historyProvider.getMetaStore()),
                );
                if (result.success) {
                    void vscode.window.showInformationMessage(t('msg.lokiPushed'));
                } else {
                    void vscode.window.showErrorMessage(
                        t('msg.lokiPushFailed', result.errorMessage ?? 'Unknown error'),
                    );
                }
            }),
        vscode.commands.registerCommand('saropaLogCapture.setLokiApiKey', async () => {
            const token = await vscode.window.showInputBox({
                prompt: t('prompt.lokiApiKey'),
                password: true,
                placeHolder: t('prompt.lokiApiKeyPlaceholder'),
            });
            if (token === undefined) { return; }
            const trimmed = token.trim();
            if (!trimmed) {
                void vscode.window.showWarningMessage(t('msg.lokiApiKeyEmpty'));
                return;
            }
            await setLokiBearerToken(context, trimmed);
            void vscode.window.showInformationMessage(t('msg.lokiApiKeyStored'));
        }),
        buildCiTokenCmd(context, { commandId: 'setBuildCiGithubToken', label: 'GitHub', setFn: setBuildCiGithubToken }),
        buildCiTokenCmd(context, { commandId: 'clearBuildCiGithubToken', label: 'GitHub', clearFn: deleteBuildCiGithubToken }),
        buildCiTokenCmd(context, { commandId: 'setBuildCiAzurePat', label: 'Azure PAT', setFn: setBuildCiAzurePat }),
        buildCiTokenCmd(context, { commandId: 'clearBuildCiAzurePat', label: 'Azure PAT', clearFn: deleteBuildCiAzurePat }),
        buildCiTokenCmd(context, { commandId: 'setBuildCiGitlabToken', label: 'GitLab', setFn: setBuildCiGitlabToken }),
        buildCiTokenCmd(context, { commandId: 'clearBuildCiGitlabToken', label: 'GitLab', clearFn: deleteBuildCiGitlabToken }),
    ];
}
