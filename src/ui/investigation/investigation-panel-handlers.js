"use strict";
/**
 * Investigation Panel Handlers
 *
 * Message handlers for source management and search operations
 * in the investigation panel.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptAddSource = promptAddSource;
exports.handleRemoveSource = handleRemoveSource;
exports.handleOpenSource = handleOpenSource;
exports.handleOpenResult = handleOpenResult;
exports.handleSearch = handleSearch;
exports.performSearch = performSearch;
exports.renderEmptyResults = renderEmptyResults;
exports.renderSearchResultsCompact = renderSearchResultsCompact;
exports.handleUpdateNotes = handleUpdateNotes;
exports.getSearchHistoryHtml = getSearchHistoryHtml;
exports.handleClearSearchHistory = handleClearSearchHistory;
exports.checkMissingSources = checkMissingSources;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const ansi_1 = require("../../modules/capture/ansi");
const investigation_search_1 = require("../../modules/investigation/investigation-search");
let currentSearchCancellation;
async function promptAddSource(store, refreshPanel) {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) {
        return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: true,
        defaultUri: folder.uri,
        filters: { 'Log Files': ['log', 'txt', 'json'] },
        title: (0, l10n_1.t)('title.selectSourcesToPin'),
    });
    if (!uris || uris.length === 0) {
        return;
    }
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
async function handleRemoveSource(store, relativePath, refreshPanel) {
    if (!relativePath) {
        return;
    }
    const investigation = await store.getActiveInvestigation();
    if (!investigation) {
        return;
    }
    await store.removeSource(investigation.id, relativePath);
    await refreshPanel();
}
async function handleOpenSource(relativePath) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !relativePath) {
        return;
    }
    const uri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
        await vscode.window.showTextDocument(uri);
    }
    catch {
        vscode.window.showWarningMessage((0, l10n_1.t)('msg.sourceFileNotFound', relativePath));
    }
}
async function handleOpenResult(relativePath, line) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !relativePath) {
        return;
    }
    const uri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
    catch {
        vscode.window.showWarningMessage((0, l10n_1.t)('msg.sourceFileNotFound', relativePath));
    }
}
async function handleSearch(store, options, panel) {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) {
        return;
    }
    currentSearchCancellation?.cancel();
    currentSearchCancellation?.dispose();
    await store.updateLastSearchQuery(investigation.id, options.query || undefined);
    if (!options.query.trim()) {
        panel.webview.postMessage({ type: 'searchResults', html: renderEmptyResults() });
        return;
    }
    await store.addToSearchHistory(options.query);
    currentSearchCancellation = new vscode.CancellationTokenSource();
    panel.webview.postMessage({ type: 'searchProgress', searching: true, message: (0, l10n_1.t)('msg.searching') });
    const result = await performSearch(investigation, options, currentSearchCancellation.token, (current, total, _file) => {
        panel.webview.postMessage({
            type: 'searchProgress',
            searching: true,
            message: (0, l10n_1.t)('msg.searchingFile', String(current), String(total)),
            current,
            total,
        });
    });
    panel.webview.postMessage({ type: 'searchProgress', searching: false });
    panel.webview.postMessage({ type: 'searchResults', html: renderSearchResults(result, options.query) });
}
async function performSearch(investigation, options, token, progress) {
    const searchOptions = {
        query: options.query,
        caseSensitive: options.caseSensitive ?? false,
        useRegex: options.useRegex ?? false,
        contextLines: options.contextLines ?? 2,
    };
    return (0, investigation_search_1.searchInvestigation)(investigation, searchOptions, token, progress);
}
function renderSearchResults(result, query) {
    if (result.cancelled) {
        return `<div class="search-cancelled">${(0, l10n_1.t)('msg.searchCancelled')}</div>`;
    }
    if (result.results.length === 0) {
        return `<div class="empty-sources">${(0, l10n_1.t)('msg.noSearchResults')}</div>`;
    }
    let html = `<div class="results-header">`;
    html += (0, l10n_1.t)('msg.searchResultsCount', String(result.totalMatches), String(result.totalSources));
    html += ` <span class="search-time">(${result.searchTimeMs}ms)</span>`;
    html += `</div>`;
    for (const sourceResult of result.results) {
        const fileName = sourceResult.sourceFile.split(/[/\\]/).pop() ?? sourceResult.sourceFile;
        const isMainSource = sourceResult.sourceFile === sourceResult.source.relativePath;
        html += `<div class="result-group">`;
        html += `<div class="result-group-header">`;
        html += `<span class="result-group-name">${(0, ansi_1.escapeHtml)(fileName)}</span>`;
        html += `<span class="result-group-count">(${sourceResult.matches.length}${sourceResult.truncated ? '+' : ''})</span>`;
        if (!isMainSource) {
            html += `<span class="result-group-sidecar">sidecar</span>`;
        }
        if (sourceResult.largeFileWarning) {
            html += `<span class="result-group-warning" title="${(0, l10n_1.t)('msg.largeFileWarning')}">⚠️</span>`;
        }
        html += `</div>`;
        for (const match of sourceResult.matches) {
            html += renderMatchHtml(match, sourceResult.sourceFile, query);
        }
        if (sourceResult.truncated) {
            html += `<div class="result-truncated">${(0, l10n_1.t)('msg.resultsTruncated')}</div>`;
        }
        html += `</div>`;
    }
    return html;
}
/** Render a single search match with its context lines as HTML. */
function renderMatchHtml(match, sourceFile, query) {
    let html = '';
    if (match.contextBefore && match.contextBefore.length > 0) {
        for (let i = 0; i < match.contextBefore.length; i++) {
            const contextLine = match.line - (match.contextBefore.length - i);
            html += `<div class="result-context" data-path="${(0, ansi_1.escapeHtml)(sourceFile)}" data-line="${contextLine}">`;
            html += `<span class="result-line context-line">:${contextLine}</span>${(0, ansi_1.escapeHtml)(match.contextBefore[i])}`;
            html += `</div>`;
        }
    }
    const highlighted = highlightMatches(match.text, query);
    html += `<div class="result-item" data-path="${(0, ansi_1.escapeHtml)(sourceFile)}" data-line="${match.line}">`;
    html += `<span class="result-line">:${match.line}</span>${highlighted}`;
    html += `</div>`;
    if (match.contextAfter && match.contextAfter.length > 0) {
        for (let i = 0; i < match.contextAfter.length; i++) {
            const contextLine = match.line + i + 1;
            html += `<div class="result-context" data-path="${(0, ansi_1.escapeHtml)(sourceFile)}" data-line="${contextLine}">`;
            html += `<span class="result-line context-line">:${contextLine}</span>${(0, ansi_1.escapeHtml)(match.contextAfter[i])}`;
            html += `</div>`;
        }
    }
    return html;
}
function highlightMatches(text, query) {
    const escaped = (0, ansi_1.escapeHtml)(text);
    try {
        const pattern = (0, investigation_search_1.escapeRegex)((0, ansi_1.escapeHtml)(query));
        return escaped.replace(new RegExp(pattern, 'gi'), '<span class="result-match">$&</span>');
    }
    catch {
        return escaped;
    }
}
function renderEmptyResults() {
    return `<div class="empty-sources">${(0, l10n_1.t)('msg.typeToSearch')}</div>`;
}
/** Render search results without context lines (for panel refresh). */
function renderSearchResultsCompact(result, query) {
    if (result.results.length === 0) {
        return `<div class="empty-sources">${(0, l10n_1.t)('msg.noSearchResults')}</div>`;
    }
    let html = `<div class="results-header">`;
    html += (0, l10n_1.t)('msg.searchResultsCount', String(result.totalMatches), String(result.totalSources));
    html += ` <span class="search-time">(${result.searchTimeMs}ms)</span>`;
    html += `</div>`;
    for (const sourceResult of result.results) {
        const fileName = sourceResult.sourceFile.split(/[/\\]/).pop() ?? sourceResult.sourceFile;
        html += `<div class="result-group">`;
        html += `<div class="result-group-header">${(0, ansi_1.escapeHtml)(fileName)} (${sourceResult.matches.length})</div>`;
        for (const match of sourceResult.matches) {
            const highlighted = highlightMatches(match.text, query);
            html += `<div class="result-item" data-path="${(0, ansi_1.escapeHtml)(sourceResult.sourceFile)}" data-line="${match.line}">`;
            html += `<span class="result-line">:${match.line}</span>${highlighted}`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    return html;
}
async function handleUpdateNotes(store, notes) {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) {
        return;
    }
    await store.updateNotes(investigation.id, notes);
}
async function getSearchHistoryHtml(store) {
    const history = await store.getSearchHistory();
    if (history.length === 0) {
        return `<div class="history-empty">${(0, l10n_1.t)('msg.noSearchHistory')}</div>`;
    }
    let html = `<div class="history-list">`;
    for (const query of history) {
        html += `<div class="history-item" data-query="${(0, ansi_1.escapeHtml)(query)}">${(0, ansi_1.escapeHtml)(query)}</div>`;
    }
    html += `<div class="history-clear">${(0, l10n_1.t)('action.clearHistory')}</div>`;
    html += `</div>`;
    return html;
}
async function handleClearSearchHistory(store) {
    await store.clearSearchHistory();
}
/** Check which sources are missing and return their paths (parallel checks). */
async function checkMissingSources(investigation) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return [];
    }
    const checks = await Promise.all(investigation.sources.map(async (source) => ({
        path: source.relativePath,
        exists: await (0, investigation_search_1.checkSourceExists)(source, folder.uri),
    })));
    return checks.filter((c) => !c.exists).map((c) => c.path);
}
//# sourceMappingURL=investigation-panel-handlers.js.map