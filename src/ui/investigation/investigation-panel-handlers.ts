/**
 * Investigation Panel Handlers
 *
 * Message handlers for source management and search operations
 * in the investigation panel.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import { InvestigationStore } from '../../modules/investigation/investigation-store';
import { searchInvestigation, checkSourceExists, escapeRegex } from '../../modules/investigation/investigation-search';
import type { Investigation, SearchOptions, InvestigationSearchResult } from '../../modules/investigation/investigation-types';

let currentSearchCancellation: vscode.CancellationTokenSource | undefined;

export async function promptAddSource(
    store: InvestigationStore,
    refreshPanel: () => Promise<void>,
): Promise<void> {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) { return; }

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return; }

    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: true,
        defaultUri: folder.uri,
        filters: { 'Log Files': ['log', 'txt', 'json'] },
        title: t('title.selectSourcesToPin'),
    });

    if (!uris || uris.length === 0) { return; }

    for (const uri of uris) {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        const label = uri.path.split('/').pop() ?? relativePath;
        const isSession = uri.fsPath.endsWith('.log');
        await store.addSource(investigation.id, {
            type: isSession ? 'session' : 'file',
            relativePath,
            label,
        });
    }
    await refreshPanel();
}

export async function handleRemoveSource(
    store: InvestigationStore,
    relativePath: string,
    refreshPanel: () => Promise<void>,
): Promise<void> {
    if (!relativePath) { return; }
    const investigation = await store.getActiveInvestigation();
    if (!investigation) { return; }
    await store.removeSource(investigation.id, relativePath);
    await refreshPanel();
}

export async function handleOpenSource(relativePath: string): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !relativePath) { return; }
    const uri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
        await vscode.window.showTextDocument(uri);
    } catch {
        vscode.window.showWarningMessage(t('msg.sourceFileNotFound', relativePath));
    }
}

export async function handleOpenResult(relativePath: string, line: number): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !relativePath) { return; }
    const uri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch {
        vscode.window.showWarningMessage(t('msg.sourceFileNotFound', relativePath));
    }
}

export interface SearchOptionsMessage {
    query: string;
    caseSensitive?: boolean;
    useRegex?: boolean;
    contextLines?: number;
}

export async function handleSearch(
    store: InvestigationStore,
    options: SearchOptionsMessage,
    panel: vscode.WebviewPanel,
): Promise<void> {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) { return; }

    currentSearchCancellation?.cancel();
    currentSearchCancellation?.dispose();

    await store.updateLastSearchQuery(investigation.id, options.query || undefined);

    if (!options.query.trim()) {
        panel.webview.postMessage({ type: 'searchResults', html: renderEmptyResults() });
        return;
    }

    await store.addToSearchHistory(options.query);

    currentSearchCancellation = new vscode.CancellationTokenSource();

    panel.webview.postMessage({ type: 'searchProgress', searching: true, message: t('msg.searching') });

    const result = await performSearch(investigation, options, currentSearchCancellation.token, (current, total, _file) => {
        panel.webview.postMessage({
            type: 'searchProgress',
            searching: true,
            message: t('msg.searchingFile', String(current), String(total)),
            current,
            total,
        });
    });

    panel.webview.postMessage({ type: 'searchProgress', searching: false });
    panel.webview.postMessage({ type: 'searchResults', html: renderSearchResults(result, options.query) });
}

export async function performSearch(
    investigation: Investigation,
    options: SearchOptionsMessage,
    token?: vscode.CancellationToken,
    progress?: (current: number, total: number, file: string) => void,
): Promise<InvestigationSearchResult> {
    const searchOptions: SearchOptions = {
        query: options.query,
        caseSensitive: options.caseSensitive ?? false,
        useRegex: options.useRegex ?? false,
        contextLines: options.contextLines ?? 2,
    };

    return searchInvestigation(investigation, searchOptions, token, progress);
}

function renderSearchResults(result: InvestigationSearchResult, query: string): string {
    if (result.cancelled) {
        return `<div class="search-cancelled">${t('msg.searchCancelled')}</div>`;
    }

    if (result.results.length === 0) {
        return `<div class="empty-sources">${t('msg.noSearchResults')}</div>`;
    }

    let html = `<div class="results-header">`;
    html += t('msg.searchResultsCount', String(result.totalMatches), String(result.totalSources));
    html += ` <span class="search-time">(${result.searchTimeMs}ms)</span>`;
    html += `</div>`;

    for (const sourceResult of result.results) {
        const fileName = sourceResult.sourceFile.split(/[/\\]/).pop() ?? sourceResult.sourceFile;
        const isMainSource = sourceResult.sourceFile === sourceResult.source.relativePath;

        html += `<div class="result-group">`;
        html += `<div class="result-group-header">`;
        html += `<span class="result-group-name">${escapeHtml(fileName)}</span>`;
        html += `<span class="result-group-count">(${sourceResult.matches.length}${sourceResult.truncated ? '+' : ''})</span>`;
        if (!isMainSource) {
            html += `<span class="result-group-sidecar">sidecar</span>`;
        }
        if (sourceResult.largeFileWarning) {
            html += `<span class="result-group-warning" title="${t('msg.largeFileWarning')}">⚠️</span>`;
        }
        html += `</div>`;

        for (const match of sourceResult.matches) {
            if (match.contextBefore && match.contextBefore.length > 0) {
                for (let i = 0; i < match.contextBefore.length; i++) {
                    const contextLine = match.line - (match.contextBefore.length - i);
                    html += `<div class="result-context" data-path="${escapeHtml(sourceResult.sourceFile)}" data-line="${contextLine}">`;
                    html += `<span class="result-line context-line">:${contextLine}</span>${escapeHtml(match.contextBefore[i])}`;
                    html += `</div>`;
                }
            }

            const highlighted = highlightMatches(match.text, query);
            html += `<div class="result-item" data-path="${escapeHtml(sourceResult.sourceFile)}" data-line="${match.line}">`;
            html += `<span class="result-line">:${match.line}</span>${highlighted}`;
            html += `</div>`;

            if (match.contextAfter && match.contextAfter.length > 0) {
                for (let i = 0; i < match.contextAfter.length; i++) {
                    const contextLine = match.line + i + 1;
                    html += `<div class="result-context" data-path="${escapeHtml(sourceResult.sourceFile)}" data-line="${contextLine}">`;
                    html += `<span class="result-line context-line">:${contextLine}</span>${escapeHtml(match.contextAfter[i])}`;
                    html += `</div>`;
                }
            }
        }

        if (sourceResult.truncated) {
            html += `<div class="result-truncated">${t('msg.resultsTruncated')}</div>`;
        }
        html += `</div>`;
    }

    return html;
}

function highlightMatches(text: string, query: string): string {
    const escaped = escapeHtml(text);
    try {
        const pattern = escapeRegex(escapeHtml(query));
        return escaped.replace(new RegExp(pattern, 'gi'), '<span class="result-match">$&</span>');
    } catch {
        return escaped;
    }
}

export function renderEmptyResults(): string {
    return `<div class="empty-sources">${t('msg.typeToSearch')}</div>`;
}

/** Render search results without context lines (for panel refresh). */
export function renderSearchResultsCompact(result: InvestigationSearchResult, query: string): string {
    if (result.results.length === 0) {
        return `<div class="empty-sources">${t('msg.noSearchResults')}</div>`;
    }

    let html = `<div class="results-header">`;
    html += t('msg.searchResultsCount', String(result.totalMatches), String(result.totalSources));
    html += ` <span class="search-time">(${result.searchTimeMs}ms)</span>`;
    html += `</div>`;

    for (const sourceResult of result.results) {
        const fileName = sourceResult.sourceFile.split(/[/\\]/).pop() ?? sourceResult.sourceFile;
        html += `<div class="result-group">`;
        html += `<div class="result-group-header">${escapeHtml(fileName)} (${sourceResult.matches.length})</div>`;
        for (const match of sourceResult.matches) {
            const highlighted = highlightMatches(match.text, query);
            html += `<div class="result-item" data-path="${escapeHtml(sourceResult.sourceFile)}" data-line="${match.line}">`;
            html += `<span class="result-line">:${match.line}</span>${highlighted}`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    return html;
}

export async function handleUpdateNotes(store: InvestigationStore, notes: string): Promise<void> {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) { return; }
    await store.updateNotes(investigation.id, notes);
}

export async function getSearchHistoryHtml(store: InvestigationStore): Promise<string> {
    const history = await store.getSearchHistory();
    if (history.length === 0) {
        return `<div class="history-empty">${t('msg.noSearchHistory')}</div>`;
    }
    let html = `<div class="history-list">`;
    for (const query of history) {
        html += `<div class="history-item" data-query="${escapeHtml(query)}">${escapeHtml(query)}</div>`;
    }
    html += `<div class="history-clear">${t('action.clearHistory')}</div>`;
    html += `</div>`;
    return html;
}

export async function handleClearSearchHistory(store: InvestigationStore): Promise<void> {
    await store.clearSearchHistory();
}

/** Check which sources are missing and return their paths (parallel checks). */
export async function checkMissingSources(investigation: Investigation): Promise<string[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return []; }

    const checks = await Promise.all(
        investigation.sources.map(async (source) => ({
            path: source.relativePath,
            exists: await checkSourceExists(source, folder.uri),
        })),
    );

    return checks.filter((c) => !c.exists).map((c) => c.path);
}
