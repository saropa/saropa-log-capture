/**
 * Insights export command and scope resolution.
 * Extracted to keep commands-export.ts under the line limit.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './l10n';
import type { CommandDeps } from './commands-deps';
import { getLogDirectoryUri } from './modules/config/config';
import { formatInsightsSummaryToCsv, formatInsightsSummaryToJson } from './modules/export/insights-export-formats';
import { aggregateInsights, buildInsightsFromMetas, type CrossSessionInsights } from './modules/misc/cross-session-aggregator';
import { loadMetasForPaths } from './modules/session/metadata-loader';
import { buildInsightsSummary } from './modules/insights/insights-summary';

export type ScopeChoice = 'currentSession' | 'investigation' | '7d' | 'all';

/** Resolve cross-session insights for the chosen scope (current session, investigation, 7d, or all). */
export async function resolveInsights(
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

export function exportSignalsSummaryCmd(
    viewerProvider: CommandDeps['viewerProvider'],
    investigationStore: CommandDeps['investigationStore'],
): vscode.Disposable {
    return vscode.commands.registerCommand('saropaLogCapture.exportSignalsSummary', async () => {
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
