/**
 * Cross-session analysis panel.
 *
 * WebviewPanel showing search results for tokens extracted from a log line,
 * grouped by type, plus workspace context (git history, source annotations).
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../modules/ansi';
import { getNonce } from './viewer-content';
import { type SearchResults, searchLogFiles, openLogAtLine } from '../modules/log-search';
import { type AnalysisToken, extractAnalysisTokens } from '../modules/line-analyzer';
import { extractSourceReference } from '../modules/source-linker';
import { analyzeSourceFile, type WorkspaceFileInfo } from '../modules/workspace-analyzer';

interface TokenResultGroup { readonly token: AnalysisToken; readonly results: SearchResults; }

let panel: vscode.WebviewPanel | undefined;

/** Run analysis for a log line and show results in the panel. */
export async function showAnalysis(lineText: string): Promise<void> {
    const tokens = extractAnalysisTokens(lineText);
    if (tokens.length === 0) {
        vscode.window.showInformationMessage('No analyzable tokens found in this line.');
        return;
    }

    ensurePanel();
    panel!.webview.html = buildLoadingHtml(lineText, tokens);

    const sourceToken = tokens.find(t => t.type === 'source-file');
    const sourceRef = extractSourceReference(lineText);
    const [groups, wsInfo] = await Promise.all([
        Promise.all(tokens.map(async (token): Promise<TokenResultGroup> => ({
            token, results: await searchLogFiles(token.value, { maxResults: 50, maxResultsPerFile: 10 }),
        }))),
        sourceToken ? analyzeSourceFile(sourceToken.value, sourceRef?.line) : Promise.resolve(undefined),
    ]);

    if (panel) { panel.webview.html = buildResultsHtml(lineText, groups, wsInfo); }
}

/** Dispose the singleton panel. */
export function disposeAnalysisPanel(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(vscode.ViewColumn.Beside); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.analysis', 'Line Analysis',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage((msg: Record<string, unknown>) => {
        if (msg.type === 'openMatch') {
            const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
            openLogAtLine(match).catch(() => {});
        } else if (msg.type === 'openSource') {
            const uri = vscode.Uri.parse(String(msg.uri));
            const line = Number(msg.line ?? 1);
            vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
        }
    });
    panel.onDidDispose(() => { panel = undefined; });
}

const typeIcons: Record<string, string> = {
    'source-file': '📄', 'error-class': '⚠️', 'http-status': '🌐',
    'url-path': '🔗', 'quoted-string': '💬', 'class-method': '🔧',
};

function buildLoadingHtml(lineText: string, tokens: AnalysisToken[]): string {
    const nonce = getNonce();
    const tokenList = tokens.map(t => `<span class="token">${typeIcons[t.type] ?? '🔍'} ${escapeHtml(t.label)}</span>`).join('');
    return wrapHtml(nonce, `
        <div class="header"><div class="analyzed-line">${escapeHtml(lineText)}</div></div>
        <div class="content"><div class="loading">Searching ${tokens.length} token${tokens.length > 1 ? 's' : ''}... ${tokenList}</div></div>`);
}

function buildResultsHtml(lineText: string, groups: TokenResultGroup[], wsInfo?: WorkspaceFileInfo): string {
    const nonce = getNonce();
    const total = groups.reduce((s, g) => s + g.results.matches.length, 0);
    const filesHit = new Set(groups.flatMap(g => g.results.matches.map(m => m.filename))).size;
    let body = `<div class="header">
        <div class="analyzed-line">${escapeHtml(lineText)}</div>
        <div class="summary">${total} session match${total !== 1 ? 'es' : ''} across ${filesHit} file${filesHit !== 1 ? 's' : ''}${wsInfo ? ' · source file found in workspace' : ''}</div></div><div class="content">`;

    if (wsInfo) { body += renderWorkspaceInfo(wsInfo); }
    for (const group of groups) { body += renderTokenGroup(group); }

    body += '</div>';
    return wrapHtml(nonce, body);
}

function renderSourcePreview(info: WorkspaceFileInfo): string {
    if (!info.sourcePreview) { return ''; }
    const { lines, targetLine } = info.sourcePreview;
    const uriStr = info.uri.toString();
    let html = `<details class="group" open><summary class="group-header">📄 Source Code <span class="match-count">line ${targetLine}</span></summary><div class="source-preview">`;
    for (const l of lines) {
        const cls = l.num === targetLine ? 'source-line target-line' : 'source-line';
        html += `<div class="${cls}" data-source-uri="${escapeHtml(uriStr)}" data-line="${l.num}"><span class="line-num">L${l.num}</span><span class="line-text">${escapeHtml(l.text)}</span></div>`;
    }
    return html + '</div></details>';
}

function renderWorkspaceInfo(info: WorkspaceFileInfo): string {
    const uriStr = info.uri.toString();
    let html = renderSourcePreview(info);
    if (info.gitCommits.length > 0) {
        html += `<details class="group" open><summary class="group-header">🕐 Git History <span class="match-count">${info.gitCommits.length} commit${info.gitCommits.length !== 1 ? 's' : ''}</span></summary>`;
        for (const c of info.gitCommits) {
            html += `<div class="commit-line"><span class="commit-hash">${escapeHtml(c.hash)}</span><span class="commit-date">${escapeHtml(c.date)}</span><span class="commit-msg">${escapeHtml(c.message)}</span></div>`;
        }
        html += '</details>';
    }
    if (info.annotations.length > 0) {
        html += `<details class="group" open><summary class="group-header">📝 Source Annotations <span class="match-count">${info.annotations.length} found</span></summary>`;
        for (const a of info.annotations) {
            html += `<div class="annotation-line" data-source-uri="${escapeHtml(uriStr)}" data-line="${a.line}">
                <span class="anno-type anno-${a.type.toLowerCase()}">${escapeHtml(a.type)}</span>
                <span class="line-num">L${a.line}</span>
                <span class="line-text">${escapeHtml(a.text)}</span></div>`;
        }
        html += '</details>';
    }
    if (!info.sourcePreview && info.gitCommits.length === 0 && info.annotations.length === 0) {
        html += '<div class="no-matches">Source file found but no git history or annotations</div>';
    }
    return html;
}

function renderTokenGroup(group: TokenResultGroup): string {
    const icon = typeIcons[group.token.type] ?? '🔍';
    const count = group.results.matches.length;
    let html = `<details class="group" ${count > 0 ? 'open' : ''}>
        <summary class="group-header">${icon} ${escapeHtml(group.token.label)} <span class="match-count">${count} match${count !== 1 ? 'es' : ''} in ${group.results.filesWithMatches} file${group.results.filesWithMatches !== 1 ? 's' : ''}</span></summary>`;
    if (count === 0) {
        html += '<div class="no-matches">No matches in other sessions</div>';
    } else {
        const byFile = new Map<string, typeof group.results.matches[number][]>();
        for (const m of group.results.matches) {
            (byFile.get(m.filename) ?? (byFile.set(m.filename, []), byFile.get(m.filename)!)).push(m);
        }
        for (const [filename, matches] of byFile) {
            html += `<div class="file-group"><div class="file-name">📁 ${escapeHtml(filename)} (${matches.length})</div>`;
            for (const m of matches) {
                html += `<div class="match-line" data-uri="${escapeHtml(m.uri.toString())}" data-filename="${escapeHtml(filename)}" data-line="${m.lineNumber}">
                    <span class="line-num">L${m.lineNumber}</span>
                    <span class="line-text">${escapeHtml(m.lineText.trim())}</span></div>`;
            }
            html += '</div>';
        }
    }
    return html + '</details>';
}

function wrapHtml(nonce: string, body: string): string {
    return /* html */ `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getStyles()}</style></head><body>${body}
<script nonce="${nonce}">${getScript()}</script></body></html>`;
}

function getStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family, sans-serif); font-size: 13px; }
.header { padding: 12px 16px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); }
.analyzed-line { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; color: var(--vscode-descriptionForeground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.summary { font-size: 11px; color: var(--vscode-descriptionForeground); }
.content { padding: 8px; }
.loading { padding: 16px; color: var(--vscode-descriptionForeground); }
.token { display: inline-block; margin: 4px 4px 0 0; padding: 2px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 11px; }
.group { margin-bottom: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
.group-header { padding: 8px 12px; cursor: pointer; font-weight: 600; font-size: 13px; list-style: none; }
.group-header::-webkit-details-marker { display: none; }
.group-header::before { content: '▶ '; font-size: 10px; }
details[open] > .group-header::before { content: '▼ '; }
.match-count { font-weight: normal; color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: 8px; }
.no-matches { padding: 8px 12px; color: var(--vscode-disabledForeground); font-style: italic; font-size: 12px; }
.file-group { margin: 4px 8px; }
.file-name { padding: 4px 8px; font-size: 12px; font-weight: 500; color: var(--vscode-textLink-foreground); }
.match-line, .annotation-line { display: flex; gap: 8px; padding: 3px 8px 3px 24px; cursor: pointer; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; border-radius: 3px; }
.match-line:hover, .annotation-line:hover { background: var(--vscode-list-hoverBackground); }
.line-num { color: var(--vscode-editorLineNumber-foreground); min-width: 40px; flex-shrink: 0; }
.line-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.commit-line { display: flex; gap: 10px; padding: 3px 8px 3px 24px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.commit-hash { color: var(--vscode-textLink-foreground); min-width: 60px; }
.commit-date { color: var(--vscode-descriptionForeground); min-width: 80px; }
.commit-msg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.anno-type { font-size: 10px; font-weight: 700; padding: 0 4px; border-radius: 3px; min-width: 44px; text-align: center; }
.anno-todo { background: var(--vscode-editorInfo-foreground, #3794ff); color: #fff; }
.anno-fixme { background: var(--vscode-editorWarning-foreground, #cca700); color: #000; }
.anno-hack { background: var(--vscode-editorWarning-foreground, #cca700); color: #000; }
.anno-bug { background: var(--vscode-editorError-foreground, #f14c4c); color: #fff; }
.anno-note { background: var(--vscode-descriptionForeground); color: var(--vscode-editor-background); }
.anno-xxx { background: var(--vscode-editorError-foreground, #f14c4c); color: #fff; }
.source-preview { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.source-line { display: flex; gap: 8px; padding: 1px 8px 1px 24px; cursor: pointer; }
.source-line:hover { background: var(--vscode-list-hoverBackground); }
.target-line { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 200, 0, 0.2)); border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding-left: 21px; }
.target-line:hover { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 200, 0, 0.3)); }`;
}

function getScript(): string {
    return /* javascript */ `
const vscodeApi = acquireVsCodeApi();
document.addEventListener('click', function(e) {
    var line = e.target.closest('.match-line');
    if (line) { vscodeApi.postMessage({ type: 'openMatch', uri: line.dataset.uri, filename: line.dataset.filename, line: parseInt(line.dataset.line) }); return; }
    var src = e.target.closest('.source-line');
    if (src) { vscodeApi.postMessage({ type: 'openSource', uri: src.dataset.sourceUri, line: parseInt(src.dataset.line) }); return; }
    var anno = e.target.closest('.annotation-line');
    if (anno) { vscodeApi.postMessage({ type: 'openSource', uri: anno.dataset.sourceUri, line: parseInt(anno.dataset.line) }); }
});`;
}
