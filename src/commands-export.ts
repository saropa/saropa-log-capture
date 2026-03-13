/** Export-related commands (HTML, CSV, JSON, SLC, Loki). */

import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './l10n';
import type { CommandDeps } from './commands-deps';
import { getConfig, getLogDirectoryUri } from './modules/config/config';
import { exportToHtml } from './modules/export/html-export';
import { exportToInteractiveHtml } from './modules/export/html-export-interactive';
import { exportToCsv, exportToJson, exportToJsonl } from './modules/export/export-formats';
import { formatInsightsSummaryToCsv, formatInsightsSummaryToJson } from './modules/export/insights-export-formats';
import { exportSessionToSlc, importSlcBundle, type ImportSlcResult } from './modules/export/slc-bundle';
import { exportToLoki as doExportToLoki, setLokiBearerToken } from './modules/export/loki-export';
import {
    setBuildCiGithubToken, deleteBuildCiGithubToken,
    setBuildCiAzurePat, deleteBuildCiAzurePat,
    setBuildCiGitlabToken, deleteBuildCiGitlabToken,
} from './modules/integrations/providers/build-ci';
import { aggregateInsights, buildInsightsFromMetas, type CrossSessionInsights } from './modules/misc/cross-session-aggregator';
import { loadMetasForPaths } from './modules/session/metadata-loader';
import { buildInsightsSummary } from './modules/insights/insights-summary';

export function exportCommands(deps: CommandDeps): vscode.Disposable[] {
    const { context, viewerProvider, historyProvider, investigationStore } = deps;
    return [
        htmlExportCmd('exportHtml', exportToHtml),
        htmlExportCmd('exportHtmlInteractive', exportToInteractiveHtml),
        fileExportCmd('exportCsv', exportToCsv),
        fileExportCmd('exportJson', exportToJson),
        fileExportCmd('exportJsonl', exportToJsonl),
        exportInsightsSummaryCmd(viewerProvider, investigationStore),
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
            if (lastResult) {
                if ('mainLogUri' in lastResult) {
                    historyProvider.refresh();
                    await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                    await viewerProvider.loadFromFile(lastResult.mainLogUri);
                } else {
                    const inv = lastResult.investigation;
                    const created = await investigationStore.createInvestigation({
                        name: inv.name,
                        notes: inv.notes,
                    });
                    try {
                        for (const src of inv.sources) {
                            await investigationStore.addSource(created.id, {
                                type: src.type,
                                relativePath: src.relativePath,
                                label: src.label,
                            });
                        }
                        await investigationStore.setActiveInvestigationId(created.id);
                        historyProvider.refresh();
                        await vscode.commands.executeCommand('saropaLogCapture.openInvestigation');
                        vscode.window.showInformationMessage(t('msg.investigationImported', inv.name));
                    } catch (e) {
                        await investigationStore.deleteInvestigation(created.id).catch(() => {});
                        vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                    }
                }
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
        buildCiTokenCmd(context, 'setBuildCiGithubToken', 'GitHub', setBuildCiGithubToken),
        buildCiTokenCmd(context, 'clearBuildCiGithubToken', 'GitHub', undefined, deleteBuildCiGithubToken),
        buildCiTokenCmd(context, 'setBuildCiAzurePat', 'Azure PAT', setBuildCiAzurePat),
        buildCiTokenCmd(context, 'clearBuildCiAzurePat', 'Azure PAT', undefined, deleteBuildCiAzurePat),
        buildCiTokenCmd(context, 'setBuildCiGitlabToken', 'GitLab', setBuildCiGitlabToken),
        buildCiTokenCmd(context, 'clearBuildCiGitlabToken', 'GitLab', undefined, deleteBuildCiGitlabToken),
    ];
}

type ScopeChoice = 'currentSession' | 'investigation' | '7d' | 'all';

function exportInsightsSummaryCmd(
    viewerProvider: CommandDeps['viewerProvider'],
    investigationStore: CommandDeps['investigationStore'],
): vscode.Disposable {
    return vscode.commands.registerCommand('saropaLogCapture.exportInsightsSummary', async () => {
        const scopeItem = await vscode.window.showQuickPick(
            [
                { label: t('insightsExport.scope.currentSession'), value: 'currentSession' as ScopeChoice },
                { label: t('insightsExport.scope.investigation'), value: 'investigation' as ScopeChoice },
                { label: t('insightsExport.scope.last7Days'), value: '7d' as ScopeChoice },
                { label: t('insightsExport.scope.all'), value: 'all' as ScopeChoice },
            ],
            { title: t('insightsExport.scopeTitle'), placeHolder: t('insightsExport.scopePlaceholder') },
        );
        if (!scopeItem) { return; }

        const insights = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: t('insightsExport.progress') },
            async () => resolveInsights(scopeItem.value, viewerProvider, investigationStore),
        );

        if (!insights) {
            void vscode.window.showWarningMessage(t('insightsExport.noData'));
            return;
        }

        const formatItem = await vscode.window.showQuickPick(
            [
                { label: 'CSV', value: 'csv' as const },
                { label: 'JSON', value: 'json' as const },
            ],
            { title: t('insightsExport.formatTitle'), placeHolder: t('insightsExport.formatPlaceholder') },
        );
        if (!formatItem) { return; }

        const timeRangeLabel = scopeItem.value === '7d' ? '7d' : scopeItem.value === 'all' ? 'all' : scopeItem.value === 'investigation' ? 'investigation' : 'session';
        const summary = buildInsightsSummary(insights, { timeRangeLabel });
        const ext = formatItem.value;
        const defaultName = `insights-summary.${ext}`;
        const filters: Record<string, string[]> = ext === 'json' ? { JSON: ['json'] } : { CSV: ['csv'] };
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters,
            title: t('insightsExport.saveTitle'),
        });
        if (!uri) { return; }

        const content = formatItem.value === 'json'
            ? formatInsightsSummaryToJson(summary)
            : formatInsightsSummaryToCsv(summary);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        const action = await vscode.window.showInformationMessage(
            t('msg.exportedTo', uri.fsPath.split(/[\\/]/).pop() ?? ''),
            t('action.open'),
        );
        if (action === t('action.open')) { await vscode.window.showTextDocument(uri); }
    });
}

/** Resolve cross-session insights for the chosen scope (current session, investigation, 7d, or all). */
async function resolveInsights(
    scope: ScopeChoice,
    viewerProvider: CommandDeps['viewerProvider'],
    investigationStore: CommandDeps['investigationStore'],
): Promise<CrossSessionInsights | null> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return null; }
    const logDir = getLogDirectoryUri(folder);

    if (scope === 'currentSession') {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { return null; }
        const rel = path.relative(logDir.fsPath, uri.fsPath);
        const normalized = rel.split(path.sep).join('/');
        if (normalized.startsWith('..')) { return null; }
        const metas = await loadMetasForPaths(logDir, [normalized]);
        return metas.length > 0 ? buildInsightsFromMetas(metas) : null;
    }

    if (scope === 'investigation') {
        const inv = await investigationStore.getActiveInvestigation();
        if (!inv?.sources?.length) { return null; }
        const sessionPaths = inv.sources
            .filter(s => s.type === 'session')
            .map(s => path.relative(logDir.fsPath, path.join(folder.uri.fsPath, s.relativePath)))
            .map(p => p.split(path.sep).join('/'));
        const validPaths = sessionPaths.filter(p => !p.startsWith('..'));
        if (validPaths.length === 0) { return null; }
        const metas = await loadMetasForPaths(logDir, validPaths);
        return metas.length > 0 ? buildInsightsFromMetas(metas) : null;
    }

    if (scope === '7d') { return aggregateInsights('7d'); }
    return aggregateInsights('all');
}

function buildCiTokenCmd(
    context: vscode.ExtensionContext,
    commandId: string,
    label: string,
    setFn?: (ctx: vscode.ExtensionContext, value: string) => Promise<void>,
    clearFn?: (ctx: vscode.ExtensionContext) => Promise<void>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${commandId}`, async () => {
        if (setFn) {
            const token = await vscode.window.showInputBox({
                prompt: `Build/CI: enter ${label} token`,
                password: true,
                placeHolder: 'Token or PAT',
            });
            if (token === undefined) { return; }
            const trimmed = token.trim();
            if (!trimmed) {
                void vscode.window.showWarningMessage('Empty value not stored.');
                return;
            }
            await setFn(context, trimmed);
            void vscode.window.showInformationMessage(`Build/CI: ${label} token stored.`);
        } else if (clearFn) {
            await clearFn(context);
            void vscode.window.showInformationMessage(`Build/CI: ${label} token cleared.`);
        }
    });
}

function htmlExportCmd(
    name: string,
    fn: (uri: vscode.Uri) => Promise<vscode.Uri>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`,
      async (item: { uri: vscode.Uri }) => {
        if (!item?.uri) { return; }
        await vscode.env.openExternal(await fn(item.uri));
    });
}

function fileExportCmd(
    name: string,
    fn: (uri: vscode.Uri) => Promise<vscode.Uri>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`,
      async (item: { uri: vscode.Uri }) => {
        if (!item?.uri) { return; }
        const outUri = await fn(item.uri);
        const action = await vscode.window.showInformationMessage(
            t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
            t('action.open'),
        );
        if (action === t('action.open')) { await vscode.window.showTextDocument(outUri); }
    });
}
