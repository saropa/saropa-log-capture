/** HTML rendering functions for the analysis panel. */

import { escapeHtml } from '../modules/ansi';
import type { SearchResults } from '../modules/log-search';
import type { AnalysisToken } from '../modules/line-analyzer';
import type { WorkspaceFileInfo, GitCommit } from '../modules/workspace-analyzer';
import type { BlameLine } from '../modules/git-blame';
import type { DocScanResults } from '../modules/docs-scanner';
import type { ImportResults } from '../modules/import-extractor';
import type { SymbolResults } from '../modules/symbol-resolver';
import type { CommitDiff } from '../modules/git-diff';
import { getAnalysisStyles, getAnalysisScript } from './analysis-panel-styles';
import { type StackFrameInfo, renderFrameSection } from './analysis-frame-render';

export interface TokenResultGroup { readonly token: AnalysisToken; readonly results: SearchResults; }

const typeIcons: Record<string, string> = {
    'source-file': '📄', 'error-class': '⚠️', 'http-status': '🌐',
    'url-path': '🔗', 'quoted-string': '💬', 'class-method': '🔧',
};

/** Build the initial progressive-loading HTML shell with spinner placeholders. */
export function buildProgressiveShell(nonce: string, lineText: string, tokens: AnalysisToken[], hasSource: boolean, frames?: readonly StackFrameInfo[], hasTag = false): string {
    const tokenList = tokens.map(t => `<span class="token">${typeIcons[t.type] ?? '🔍'} ${escapeHtml(t.label)}</span>`).join('');
    let slots = '';
    if (frames && frames.length > 0) { slots += renderFrameSection(frames); }
    if (hasTag) { slots += loadingSlot('related', '📋 Scanning related lines...'); }
    slots += loadingSlot('trend', '📊 Checking cross-session history...');
    if (hasSource) {
        slots += loadingSlot('source', '📄 Analyzing source file...');
        slots += loadingSlot('line-history', '🕐 Checking recent changes...');
        slots += loadingSlot('imports', '📦 Extracting dependencies...');
    }
    if (hasTag) { slots += loadingSlot('files', '📁 Analyzing referenced files...'); }
    slots += loadingSlot('docs', '📚 Scanning project documentation...');
    slots += loadingSlot('symbols', '🔎 Resolving symbol definitions...');
    slots += loadingSlot('tokens', `🔍 Searching ${tokens.length} token${tokens.length > 1 ? 's' : ''}... ${tokenList}`);
    slots += loadingSlot('github', '🔗 Querying GitHub...');
    const sectionCount = (hasSource ? 3 : 0) + (hasTag ? 2 : 0) + 5;
    return wrapHtml(nonce, `<div class="header"><div class="analyzed-line">${escapeHtml(lineText)}</div>
        <div class="summary"><span id="progress-text">Analyzing... 0/${sectionCount} complete</span> <button class="cancel-btn" id="cancel-btn">Stop</button></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" id="progress-fill" data-total="${sectionCount}" style="width:0%"></div></div></div>
        <div id="executive-summary"></div><div class="content">${slots}</div>`);
}

function loadingSlot(id: string, message: string): string {
    return `<div class="section-slot" id="section-${id}"><div class="section-loading"><span class="spinner"></span> <span class="progress-msg">${message}</span></div></div>`;
}

/** Render the source + blame + diff section (replaces spinner). */
export function renderSourceSection(info: WorkspaceFileInfo, blame?: BlameLine, diff?: CommitDiff): string {
    let html = renderSourcePreview(info);
    if (blame) {
        html += `<div class="blame-line">Last changed by <strong>${escapeHtml(blame.author)}</strong> on ${escapeHtml(blame.date)} · <code>${escapeHtml(blame.hash)}</code> ${escapeHtml(blame.message)}</div>`;
    }
    if (diff) {
        html += `<div class="diff-summary">${diff.filesChanged} file${diff.filesChanged !== 1 ? 's' : ''} changed · +${diff.insertions} -${diff.deletions}</div>`;
    }
    if (info.gitCommits.length > 0) {
        html += `<details class="group" open><summary class="group-header">🕐 Git History <span class="match-count">${info.gitCommits.length} commit${info.gitCommits.length !== 1 ? 's' : ''}</span></summary>`;
        for (const c of info.gitCommits) {
            html += `<div class="commit-line"><span class="commit-hash">${escapeHtml(c.hash)}</span><span class="commit-date">${escapeHtml(c.date)}</span><span class="commit-msg">${escapeHtml(c.message)}</span></div>`;
        }
        html += '</details>';
    }
    if (info.annotations.length > 0) { html += renderAnnotations(info); }
    if (!html) { html = '<div class="no-matches">Source file found but no context available</div>'; }
    return doneSlot('source', html);
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

function renderAnnotations(info: WorkspaceFileInfo): string {
    const uriStr = info.uri.toString();
    let html = `<details class="group" open><summary class="group-header">📝 Source Annotations <span class="match-count">${info.annotations.length} found</span></summary>`;
    for (const a of info.annotations) {
        html += `<div class="annotation-line" data-source-uri="${escapeHtml(uriStr)}" data-line="${a.line}">
            <span class="anno-type anno-${a.type.toLowerCase()}">${escapeHtml(a.type)}</span>
            <span class="line-num">L${a.line}</span>
            <span class="line-text">${escapeHtml(a.text)}</span></div>`;
    }
    return html + '</details>';
}

/** Render line-range git history section. */
export function renderLineHistorySection(commits: readonly GitCommit[]): string {
    if (commits.length === 0) { return emptySlot('line-history', '🕐 No recent changes to this area'); }
    let html = `<details class="group" open><summary class="group-header">🕐 Recent Changes Near Error <span class="match-count">${commits.length} commit${commits.length !== 1 ? 's' : ''}</span></summary>`;
    for (const c of commits) {
        html += `<div class="commit-line"><span class="commit-hash">${escapeHtml(c.hash)}</span><span class="commit-date">${escapeHtml(c.date)}</span><span class="commit-msg">${escapeHtml(c.message)}</span></div>`;
    }
    return doneSlot('line-history', html + '</details>');
}

/** Render documentation matches section. */
export function renderDocsSection(results: DocScanResults): string {
    if (results.matches.length === 0) {
        return emptySlot('docs', `📚 No references in project docs (${results.filesScanned} files scanned)`);
    }
    let html = `<details class="group" open><summary class="group-header">📚 Project Documentation <span class="match-count">${results.matches.length} reference${results.matches.length !== 1 ? 's' : ''} in ${results.filesScanned} files</span></summary>`;
    for (const m of results.matches) {
        html += `<div class="doc-match" data-uri="${escapeHtml(m.uri.toString())}" data-line="${m.lineNumber}">
            <span class="doc-file">${escapeHtml(m.filename)}:${m.lineNumber}</span>
            <span class="doc-token">${escapeHtml(m.matchedToken)}</span>
            <span class="line-text">${escapeHtml(m.lineText.trim())}</span></div>`;
    }
    return doneSlot('docs', html + '</details>');
}

/** Render import/dependency extraction section. */
export function renderImportsSection(results: ImportResults): string {
    if (results.imports.length === 0) { return emptySlot('imports', '📦 No imports detected'); }
    const summary = `${results.localCount} local, ${results.packageCount} package`;
    let html = `<details class="group" open><summary class="group-header">📦 Dependencies <span class="match-count">${results.imports.length} imports (${summary})</span></summary>`;
    for (const imp of results.imports) {
        const cls = imp.isLocal ? 'import-local' : 'import-package';
        const badge = imp.isLocal
            ? '<span class="import-badge import-badge-local">local</span>'
            : '<span class="import-badge import-badge-pkg">pkg</span>';
        html += `<div class="import-entry"><span class="line-num">L${imp.line}</span>${badge}<span class="${cls}">${escapeHtml(imp.module)}</span></div>`;
    }
    return doneSlot('imports', html + '</details>');
}

/** Render symbol resolution section. */
export function renderSymbolsSection(results: SymbolResults): string {
    if (results.symbols.length === 0) { return emptySlot('symbols', '🔎 No symbol definitions found'); }
    let html = `<details class="group" open><summary class="group-header">🔎 Symbol Definitions <span class="match-count">${results.symbols.length} found</span></summary>`;
    for (const s of results.symbols) {
        const file = s.uri.fsPath.split(/[\\/]/).pop() ?? '';
        html += `<div class="symbol-entry" data-uri="${escapeHtml(s.uri.toString())}" data-line="${s.line}">
            <span class="symbol-kind">${escapeHtml(s.kind)}</span>
            <span class="symbol-name">${escapeHtml(s.name)}</span>
            <span class="symbol-loc">${escapeHtml(file)}:${s.line}</span>
            ${s.containerName ? `<span class="line-text">in ${escapeHtml(s.containerName)}</span>` : ''}</div>`;
    }
    return doneSlot('symbols', html + '</details>');
}

/** Render all token search results as a single section. */
export function renderTokenGroups(groups: TokenResultGroup[]): string {
    const total = groups.reduce((s, g) => s + g.results.matches.length, 0);
    const filesHit = new Set(groups.flatMap(g => g.results.matches.map(m => m.filename))).size;
    if (total === 0) { return emptySlot('tokens', '🔍 No session matches found'); }
    let html = `<div class="summary" style="padding:4px 8px;margin-bottom:4px">${total} session match${total !== 1 ? 'es' : ''} across ${filesHit} file${filesHit !== 1 ? 's' : ''}</div>`;
    for (const group of groups) { html += renderSingleTokenGroup(group); }
    return doneSlot('tokens', html);
}

function renderSingleTokenGroup(group: TokenResultGroup): string {
    const icon = typeIcons[group.token.type] ?? '🔍';
    const count = group.results.matches.length;
    let html = `<details class="group" ${count > 0 ? 'open' : ''}>
        <summary class="group-header">${icon} ${escapeHtml(group.token.label)} <span class="match-count">${count} match${count !== 1 ? 'es' : ''} in ${group.results.filesWithMatches} file${group.results.filesWithMatches !== 1 ? 's' : ''}</span></summary>`;
    if (count === 0) {
        return html + '<div class="no-matches">No matches in other sessions</div></details>';
    }
    const byFile = new Map<string, typeof group.results.matches[number][]>();
    for (const m of group.results.matches) {
        (byFile.get(m.filename) ?? (byFile.set(m.filename, []), byFile.get(m.filename)!)).push(m);
    }
    for (const [filename, matches] of byFile) {
        html += `<div class="file-group"><div class="file-name">📁 ${escapeHtml(filename)} (${matches.length})</div>`;
        for (const m of matches) {
            html += `<div class="match-line" data-uri="${escapeHtml(m.uri.toString())}" data-filename="${escapeHtml(filename)}" data-line="${m.lineNumber}">
                <span class="line-num">L${m.lineNumber}</span><span class="line-text">${escapeHtml(m.lineText.trim())}</span></div>`;
        }
        html += '</div>';
    }
    return html + '</details>';
}

/** Completed section wrapper. */
export function doneSlot(id: string, content: string): string {
    return `<div class="section-slot section-done" id="section-${id}">${content}</div>`;
}

/** Empty/no-data section. */
export function emptySlot(id: string, label: string): string {
    return `<div class="section-slot section-done" id="section-${id}"><div class="section-loading section-done"><span class="status-icon status-empty">—</span> ${label}</div></div>`;
}

/** Error section. */
export function errorSlot(id: string, label: string): string {
    return `<div class="section-slot section-done" id="section-${id}"><div class="section-loading section-done"><span class="status-icon status-error">✗</span> ${label}</div></div>`;
}

/** Wrap body content in a complete HTML document. */
export function wrapHtml(nonce: string, body: string): string {
    return /* html */ `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getAnalysisStyles()}</style></head><body>${body}
<script nonce="${nonce}">${getAnalysisScript()}</script></body></html>`;
}
