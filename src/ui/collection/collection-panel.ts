/**
 * Collection mode webview panel.
 * Shows pinned sources, cross-source search, notes, and export actions.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { CollectionStore } from '../../modules/collection/collection-store';
import { collectCollectionContext } from '../../modules/bug-report/bug-report-collector';
import { formatBugReport } from '../../modules/bug-report/bug-report-formatter';
import type { BugReportData } from '../../modules/bug-report/bug-report-collector';
import { showBugReportFromMarkdown } from '../panels/bug-report-panel';
import { buildCollectionHtml, buildNoCollectionHtml } from './collection-panel-html';
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
} from './collection-panel-handlers';

let panel: vscode.WebviewPanel | undefined;
let currentStore: CollectionStore | undefined;

/** Show the collection panel for the active collection. */
export async function showCollectionPanel(store: CollectionStore): Promise<void> {
    currentStore = store;
    ensurePanel();
    await refreshPanel();
}

/** Dispose the singleton panel. */
export function disposeCollectionPanel(): void {
    panel?.dispose();
    panel = undefined;
}

function ensurePanel(): void {
    if (panel) {
        panel.reveal();
        return;
    }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.collection',
        'Collection',
        vscode.ViewColumn.Beside,
        { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

async function refreshPanel(): Promise<void> {
    if (!panel || !currentStore) { return; }
    const collection = await currentStore.getActiveCollection();
    panel.title = collection ? `Collection: ${collection.name}` : 'Collection';

    let missingSources: string[] = [];
    if (collection) {
        missingSources = await checkMissingSources(collection);
    }

    panel.webview.html = collection
        ? buildCollectionHtml(collection, missingSources)
        : buildNoCollectionHtml();

    if (collection?.lastSearchQuery) {
        const result = await performSearch(collection, { query: collection.lastSearchQuery });
        panel.webview.postMessage({ type: 'searchResults', html: renderSearchResultsCompact(result, collection.lastSearchQuery) });
    }
}

/** Refresh the panel if it's currently open (called after external changes). */
export async function refreshCollectionPanelIfOpen(): Promise<void> {
    if (panel && currentStore) {
        await refreshPanel();
    }
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (!currentStore) { return; }

    switch (msg.type) {
        case 'close':
            await currentStore.setActiveCollectionId(undefined);
            disposeCollectionPanel();
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
            await vscode.commands.executeCommand('saropaLogCapture.exportCollection');
            break;

        case 'openSlc':
            // Opens file picker for .slc (session or collection bundle); same as Command Palette → Import .slc Bundle
            await vscode.commands.executeCommand('saropaLogCapture.importSlc');
            break;

        case 'share':
            await vscode.commands.executeCommand('saropaLogCapture.shareCollection');
            break;

        case 'generateReport': {
            const invContext = await collectCollectionContext(currentStore);
            if (!invContext) {
                vscode.window.showWarningMessage(t('msg.noActiveCollection'));
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
                collectionContext: invContext,
            };
            const markdown = formatBugReport(minimalData);
            showBugReportFromMarkdown(markdown);
            break;
        }

        case 'create':
            await vscode.commands.executeCommand('saropaLogCapture.createCollection');
            break;
    }
}
