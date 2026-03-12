/**
 * Investigation mode webview panel.
 * Shows pinned sources, cross-source search, notes, and export actions.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getNonce } from '../provider/viewer-content';
import { getInvestigationPanelStyles } from './investigation-panel-styles';
import { getInvestigationPanelScript } from './investigation-panel-script';
import { InvestigationStore } from '../../modules/investigation/investigation-store';
import type { Investigation, InvestigationSource } from '../../modules/investigation/investigation-types';

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
    panel.webview.html = investigation
        ? buildInvestigationHtml(investigation)
        : buildNoInvestigationHtml();

    // Auto-trigger search if there's a saved query
    if (investigation?.lastSearchQuery) {
        const html = await performSearch(investigation, investigation.lastSearchQuery);
        panel.webview.postMessage({ type: 'searchResults', html });
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
            await promptAddSource();
            break;

        case 'removeSource':
            await handleRemoveSource(String(msg.path ?? ''));
            break;

        case 'openSource':
            await handleOpenSource(String(msg.path ?? ''));
            break;

        case 'openResult':
            await handleOpenResult(String(msg.path ?? ''), Number(msg.line ?? 1));
            break;

        case 'search':
            await handleSearch(String(msg.query ?? ''));
            break;

        case 'updateNotes':
            await handleUpdateNotes(String(msg.notes ?? ''));
            break;

        case 'export':
            await vscode.commands.executeCommand('saropaLogCapture.exportInvestigation');
            break;

        case 'generateReport':
            vscode.window.showInformationMessage(t('msg.featureComingSoon'));
            break;

        case 'create':
            await vscode.commands.executeCommand('saropaLogCapture.createInvestigation');
            break;
    }
}

async function promptAddSource(): Promise<void> {
    if (!currentStore) { return; }
    const investigation = await currentStore.getActiveInvestigation();
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
        await currentStore.addSource(investigation.id, {
            type: isSession ? 'session' : 'file',
            relativePath,
            label,
        });
    }
    await refreshPanel();
}

async function handleRemoveSource(relativePath: string): Promise<void> {
    if (!currentStore || !relativePath) { return; }
    const investigation = await currentStore.getActiveInvestigation();
    if (!investigation) { return; }
    await currentStore.removeSource(investigation.id, relativePath);
    await refreshPanel();
}

async function handleOpenSource(relativePath: string): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !relativePath) { return; }
    const uri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
        await vscode.window.showTextDocument(uri);
    } catch {
        vscode.window.showWarningMessage(t('msg.sourceFileNotFound', relativePath));
    }
}

async function handleOpenResult(relativePath: string, line: number): Promise<void> {
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

async function handleSearch(query: string): Promise<void> {
    if (!currentStore || !panel) { return; }
    const investigation = await currentStore.getActiveInvestigation();
    if (!investigation) { return; }

    await currentStore.updateLastSearchQuery(investigation.id, query || undefined);

    if (!query.trim()) {
        panel.webview.postMessage({ type: 'searchResults', html: renderEmptyResults() });
        return;
    }

    const html = await performSearch(investigation, query);
    panel.webview.postMessage({ type: 'searchResults', html });
}

async function performSearch(investigation: Investigation, query: string): Promise<string> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return renderEmptyResults(); }

    const results: { source: InvestigationSource; matches: { line: number; text: string }[] }[] = [];
    const regex = new RegExp(escapeRegex(query), 'gi');

    for (const source of investigation.sources) {
        const uri = vscode.Uri.joinPath(folder.uri, source.relativePath);
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(data).toString('utf-8');
            const lines = content.split('\n');
            const matches: { line: number; text: string }[] = [];

            for (let i = 0; i < lines.length && matches.length < 50; i++) {
                if (regex.test(lines[i])) {
                    matches.push({ line: i + 1, text: lines[i].slice(0, 200) });
                }
                regex.lastIndex = 0;
            }

            if (matches.length > 0) {
                results.push({ source, matches });
            }
        } catch {
            // File not found or unreadable
        }
    }

    if (results.length === 0) {
        return `<div class="empty-sources">${t('msg.noSearchResults')}</div>`;
    }

    let html = `<div class="results-header">${t('msg.searchResultsCount', String(results.reduce((a, r) => a + r.matches.length, 0)), String(results.length))}</div>`;

    for (const { source, matches } of results) {
        html += `<div class="result-group">`;
        html += `<div class="result-group-header">${escapeHtml(source.label)} (${matches.length})</div>`;
        for (const match of matches.slice(0, 20)) {
            const highlighted = escapeHtml(match.text).replace(
                new RegExp(escapeRegex(escapeHtml(query)), 'gi'),
                '<span class="result-match">$&</span>',
            );
            html += `<div class="result-item" data-path="${escapeHtml(source.relativePath)}" data-line="${match.line}">`;
            html += `<span class="result-line">:${match.line}</span>${highlighted}`;
            html += `</div>`;
        }
        if (matches.length > 20) {
            html += `<div class="result-item" style="font-style: italic; cursor: default;">...and ${matches.length - 20} more</div>`;
        }
        html += `</div>`;
    }

    return html;
}

function renderEmptyResults(): string {
    return `<div class="empty-sources">${t('msg.typeToSearch')}</div>`;
}

async function handleUpdateNotes(notes: string): Promise<void> {
    if (!currentStore) { return; }
    const investigation = await currentStore.getActiveInvestigation();
    if (!investigation) { return; }
    await currentStore.updateNotes(investigation.id, notes);
}

function buildInvestigationHtml(inv: Investigation): string {
    const nonce = getNonce();
    const sourcesHtml = inv.sources.length > 0
        ? inv.sources.map(s => renderSourceItem(s)).join('')
        : `<div class="empty-sources">${t('msg.noSourcesPinned')}</div>`;

    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getInvestigationPanelStyles()}</style>
</head><body>
<div class="header">
    <div class="header-left">
        <div class="title"><span class="title-icon">🔍</span>${escapeHtml(inv.name)}</div>
        <div class="subtitle">${t('msg.investigationSources', String(inv.sources.length))}</div>
    </div>
    <div class="header-right">
        <button class="close-btn" title="${t('action.closeInvestigation')}">✕</button>
    </div>
</div>
<div class="content">
    <div class="section">
        <div class="section-title">📌 ${t('label.pinnedSources')} <button class="btn btn-secondary add-source-btn">+ ${t('action.add')}</button></div>
        <div class="sources-list">${sourcesHtml}</div>
    </div>
    <div class="search-section">
        <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" placeholder="${t('placeholder.searchSources')}" value="${escapeHtml(inv.lastSearchQuery ?? '')}">
            <button class="search-clear" title="${t('action.clear')}">✕</button>
        </div>
    </div>
    <div class="results-section">
        <div class="results-content">${inv.lastSearchQuery ? `<div class="loading"><div class="spinner"></div>${t('msg.searching')}</div>` : renderEmptyResults()}</div>
    </div>
    <div class="section notes-section">
        <div class="section-title">📝 ${t('label.notes')}</div>
        <textarea class="notes-textarea" placeholder="${t('placeholder.investigationNotes')}">${escapeHtml(inv.notes ?? '')}</textarea>
    </div>
</div>
<div class="actions-bar">
    <button class="btn export-btn">📦 ${t('action.exportSlc')}</button>
</div>
<script nonce="${nonce}">${getInvestigationPanelScript()}</script>
</body></html>`;
}

function renderSourceItem(source: InvestigationSource): string {
    const icon = source.type === 'session' ? '📄' : '📎';
    const typeLabel = source.type === 'session' ? 'session' : 'file';
    return `<div class="source-item" data-path="${escapeHtml(source.relativePath)}">
    <span class="source-icon">${icon}</span>
    <span class="source-label">${escapeHtml(source.label)}</span>
    <span class="source-type">${typeLabel}</span>
    <button class="unpin-btn" data-path="${escapeHtml(source.relativePath)}" title="${t('action.unpin')}">✕</button>
</div>`;
}

function buildNoInvestigationHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getInvestigationPanelStyles()}</style>
</head><body>
<div class="no-investigation">
    <div class="no-investigation-icon">🔍</div>
    <div class="no-investigation-title">${t('title.noActiveInvestigation')}</div>
    <div class="no-investigation-text">${t('msg.noActiveInvestigationDesc')}</div>
    <button class="btn create-btn">+ ${t('action.createInvestigation')}</button>
</div>
<script nonce="${nonce}">${getInvestigationPanelScript()}</script>
</body></html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
