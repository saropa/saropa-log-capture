/**
 * Collection Panel Handlers
 *
 * Message handlers for source management and search operations
 * in the collection panel.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import { CollectionStore } from '../../modules/collection/collection-store';
import { searchCollection, checkSourceExists, escapeRegex } from '../../modules/collection/collection-search';
import type { Collection, SearchOptions, SearchMatch, CollectionSearchResult } from '../../modules/collection/collection-types';

let currentSearchCancellation: vscode.CancellationTokenSource | undefined;

export async function promptAddSource(
    store: CollectionStore,
    refreshPanel: () => Promise<void>,
): Promise<void> {
    const collection = await store.getActiveCollection();
    if (!collection) { return; }

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
        await store.addSource(collection.id, {
            type: isSession ? 'session' : 'file',
            relativePath,
            label,
        });
    }
    await refreshPanel();
}

export async function handleRemoveSource(
    store: CollectionStore,
    relativePath: string,
    refreshPanel: () => Promise<void>,
): Promise<void> {
    if (!relativePath) { return; }
    const collection = await store.getActiveCollection();
    if (!collection) { return; }
    await store.removeSource(collection.id, relativePath);
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
    store: CollectionStore,
    options: SearchOptionsMessage,
    panel: vscode.WebviewPanel,
): Promise<void> {
    const collection = await store.getActiveCollection();
    if (!collection) { return; }

    currentSearchCancellation?.cancel();
    currentSearchCancellation?.dispose();

    await store.updateLastSearchQuery(collection.id, options.query || undefined);

    if (!options.query.trim()) {
        panel.webview.postMessage({ type: 'searchResults', html: renderEmptyResults() });
        return;
    }

    await store.addToSearchHistory(options.query);

    currentSearchCancellation = new vscode.CancellationTokenSource();

    panel.webview.postMessage({ type: 'searchProgress', searching: true, message: t('msg.searching') });

    const result = await performSearch(collection, options, currentSearchCancellation.token, (current, total, _file) => {
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
    collection: Collection,
    options: SearchOptionsMessage,
    token?: vscode.CancellationToken,
    progress?: (current: number, total: number, file: string) => void,
): Promise<CollectionSearchResult> {
    const searchOptions: SearchOptions = {
        query: options.query,
        caseSensitive: options.caseSensitive ?? false,
        useRegex: options.useRegex ?? false,
        contextLines: options.contextLines ?? 2,
    };

    return searchCollection(collection, searchOptions, token, progress);
}

function renderSearchResults(result: CollectionSearchResult, query: string): string {
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
        // After group expansion, sourceResult.source is always a file/session source (never
        // a group itself) because the resolver replaces groups with their members before search.
        // Belt-and-braces: guard anyway so a future refactor can't throw here.
        const mainPath = sourceResult.source.type === 'group' ? '' : sourceResult.source.relativePath;
        const isMainSource = sourceResult.sourceFile === mainPath;

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
            html += renderMatchHtml(match, sourceResult.sourceFile, query);
        }

        if (sourceResult.truncated) {
            html += `<div class="result-truncated">${t('msg.resultsTruncated')}</div>`;
        }
        html += `</div>`;
    }

    return html;
}

/** Render a single search match with its context lines as HTML. */
function renderMatchHtml(match: SearchMatch, sourceFile: string, query: string): string {
    let html = '';
    if (match.contextBefore && match.contextBefore.length > 0) {
        for (let i = 0; i < match.contextBefore.length; i++) {
            const contextLine = match.line - (match.contextBefore.length - i);
            html += `<div class="result-context" data-path="${escapeHtml(sourceFile)}" data-line="${contextLine}">`;
            html += `<span class="result-line context-line">:${contextLine}</span>${escapeHtml(match.contextBefore[i])}`;
            html += `</div>`;
        }
    }
    const highlighted = highlightMatches(match.text, query);
    html += `<div class="result-item" data-path="${escapeHtml(sourceFile)}" data-line="${match.line}">`;
    html += `<span class="result-line">:${match.line}</span>${highlighted}`;
    html += `</div>`;
    if (match.contextAfter && match.contextAfter.length > 0) {
        for (let i = 0; i < match.contextAfter.length; i++) {
            const contextLine = match.line + i + 1;
            html += `<div class="result-context" data-path="${escapeHtml(sourceFile)}" data-line="${contextLine}">`;
            html += `<span class="result-line context-line">:${contextLine}</span>${escapeHtml(match.contextAfter[i])}`;
            html += `</div>`;
        }
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
export function renderSearchResultsCompact(result: CollectionSearchResult, query: string): string {
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

export async function handleUpdateNotes(store: CollectionStore, notes: string): Promise<void> {
    const collection = await store.getActiveCollection();
    if (!collection) { return; }
    await store.updateNotes(collection.id, notes);
}

export async function getSearchHistoryHtml(store: CollectionStore): Promise<string> {
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

export async function handleClearSearchHistory(store: CollectionStore): Promise<void> {
    await store.clearSearchHistory();
}

/** Check which sources are missing and return their paths (parallel checks). */
export async function checkMissingSources(collection: Collection): Promise<string[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return []; }

    const checks = await Promise.all(
        collection.sources.map(async (source) => ({
            // Group sources get the synthetic "group:<id>" key; file/session sources use the
            // workspace-relative path. checkSourceExists handles both variants.
            path: source.type === 'group' ? `group:${source.groupId}` : source.relativePath,
            exists: await checkSourceExists(source, folder.uri),
        })),
    );

    return checks.filter((c) => !c.exists).map((c) => c.path);
}
