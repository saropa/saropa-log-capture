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
import type { Investigation, InvestigationSource } from '../../modules/investigation/investigation-types';

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

export async function handleSearch(
    store: InvestigationStore,
    query: string,
    panel: vscode.WebviewPanel,
): Promise<void> {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) { return; }

    await store.updateLastSearchQuery(investigation.id, query || undefined);

    if (!query.trim()) {
        panel.webview.postMessage({ type: 'searchResults', html: renderEmptyResults() });
        return;
    }

    const html = await performSearch(investigation, query);
    panel.webview.postMessage({ type: 'searchResults', html });
}

export async function performSearch(investigation: Investigation, query: string): Promise<string> {
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

export function renderEmptyResults(): string {
    return `<div class="empty-sources">${t('msg.typeToSearch')}</div>`;
}

export async function handleUpdateNotes(store: InvestigationStore, notes: string): Promise<void> {
    const investigation = await store.getActiveInvestigation();
    if (!investigation) { return; }
    await store.updateNotes(investigation.id, notes);
}
