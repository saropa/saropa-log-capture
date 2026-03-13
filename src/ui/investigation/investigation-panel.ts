/**
 * Investigation mode webview panel.
 * Shows pinned sources, cross-source search, notes, and export actions.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { InvestigationStore } from '../../modules/investigation/investigation-store';
import { collectInvestigationContext } from '../../modules/bug-report/bug-report-collector';
import { formatBugReport } from '../../modules/bug-report/bug-report-formatter';
import type { BugReportData } from '../../modules/bug-report/bug-report-collector';
import { showBugReportFromMarkdown } from '../panels/bug-report-panel';
import { buildInvestigationHtml, buildNoInvestigationHtml } from './investigation-panel-html';
import {
    promptAddSource,
    handleRemoveSource,
    handleOpenSource,
    handleOpenResult,
    handleSearch,
    handleUpdateNotes,
    performSearch,
    getSearchHistoryHtml,
    handleClearSearchHistory,
    checkMissingSources,
    renderSearchResultsCompact,
    type SearchOptionsMessage,
} from './investigation-panel-handlers';

let panel: vscode.WebviewPanel | undefined;
let currentStore: InvestigationStore | undefined;

/** Show the investigation panel for the active investigation. */
export async function showInvestigationPanel(store: InvestigationStore): Promise<void> {
    currentStore = store;
    ensurePanel();
    await refreshPanel();
}

/** Dispose the singleton panel. */
export function disposeInvestigationPanel(): void {
    panel?.dispose();
    panel = undefined;
}

function ensurePanel(): void {
    if (panel) {
        panel.reveal();
        return;
    }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.investigation',
        'Investigation',
        vscode.ViewColumn.Beside,
        { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

async function refreshPanel(): Promise<void> {
    if (!panel || !currentStore) { return; }
    const investigation = await currentStore.getActiveInvestigation();
    panel.title = investigation ? `Investigation: ${investigation.name}` : 'Investigation';

    let missingSources: string[] = [];
    if (investigation) {
        missingSources = await checkMissingSources(investigation);
    }

    panel.webview.html = investigation
        ? buildInvestigationHtml(investigation, missingSources)
        : buildNoInvestigationHtml();

    if (investigation?.lastSearchQuery) {
        const result = await performSearch(investigation, { query: investigation.lastSearchQuery });
        panel.webview.postMessage({ type: 'searchResults', html: renderSearchResultsCompact(result, investigation.lastSearchQuery) });
    }
}

/** Refresh the panel if it's currently open (called after external changes). */
export async function refreshInvestigationPanelIfOpen(): Promise<void> {
    if (panel && currentStore) {
        await refreshPanel();
    }
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (!currentStore) { return; }

    switch (msg.type) {
        case 'close':
            await currentStore.setActiveInvestigationId(undefined);
            disposeInvestigationPanel();
            break;

        case 'addSource':
            await promptAddSource(currentStore, refreshPanel);
            break;

        case 'removeSource':
            await handleRemoveSource(currentStore, String(msg.path ?? ''), refreshPanel);
            break;

        case 'openSource':
            await handleOpenSource(String(msg.path ?? ''));
            break;

        case 'openResult':
            await handleOpenResult(String(msg.path ?? ''), Number(msg.line ?? 1));
            break;

        case 'search':
            if (panel) {
                const options: SearchOptionsMessage = {
                    query: String(msg.query ?? ''),
                    caseSensitive: Boolean(msg.caseSensitive ?? false),
                    useRegex: Boolean(msg.useRegex ?? false),
                    contextLines: typeof msg.contextLines === 'number' ? msg.contextLines : 2,
                };
                await handleSearch(currentStore, options, panel);
            }
            break;

        case 'getSearchHistory':
            if (panel) {
                const historyHtml = await getSearchHistoryHtml(currentStore);
                panel.webview.postMessage({ type: 'searchHistory', html: historyHtml });
            }
            break;

        case 'clearSearchHistory':
            await handleClearSearchHistory(currentStore);
            if (panel) {
                const historyHtml = await getSearchHistoryHtml(currentStore);
                panel.webview.postMessage({ type: 'searchHistory', html: historyHtml });
            }
            break;

        case 'updateNotes':
            await handleUpdateNotes(currentStore, String(msg.notes ?? ''));
            break;

        case 'export':
            await vscode.commands.executeCommand('saropaLogCapture.exportInvestigation');
            break;

        case 'share':
            await vscode.commands.executeCommand('saropaLogCapture.shareInvestigation');
            break;

        case 'generateReport': {
            const invContext = await collectInvestigationContext(currentStore);
            if (!invContext) {
                vscode.window.showWarningMessage(t('msg.noActiveInvestigation'));
                break;
            }
            const minimalData: BugReportData = {
                errorLine: '',
                fingerprint: '',
                stackTrace: [],
                logContext: [],
                environment: {},
                devEnvironment: {},
                logFilename: '',
                lineNumber: 1,
                gitHistory: [],
                lineRangeHistory: [],
                fileAnalyses: [],
                investigationContext: invContext,
            };
            const markdown = formatBugReport(minimalData);
            showBugReportFromMarkdown(markdown);
            break;
        }

        case 'create':
            await vscode.commands.executeCommand('saropaLogCapture.createInvestigation');
            break;
    }
}
