/** HTML rendering functions for the analysis panel. */

import { escapeHtml } from '../../modules/capture/ansi';
import { t } from '../../l10n';
import type { SearchResults } from '../../modules/search/log-search';
import type { AnalysisToken } from '../../modules/analysis/line-analyzer';
import type { WorkspaceFileInfo, GitCommit } from '../../modules/misc/workspace-analyzer';
import type { BlameLine } from '../../modules/git/git-blame';
import type { DocScanResults } from '../../modules/misc/docs-scanner';
import type { ImportResults } from '../../modules/source/import-extractor';
import type { SymbolResults } from '../../modules/source/symbol-resolver';
import type { CommitDiff } from '../../modules/git/git-diff';
import { getAnalysisStyles } from './analysis-panel-styles';
import { getAnalysisErrorStyles } from './analysis-error-styles';
import { getAnalysisScript } from './analysis-panel-script';
import { type StackFrameInfo, renderFrameSection } from './analysis-frame-render';
import { renderActionBar } from './analysis-error-render';

export interface TokenResultGroup { readonly token: AnalysisToken; readonly results: SearchResults; }

const typeIcons: Record<string, string> = {
    'source-file': '📄', 'error-class': '⚠️', 'http-status': '🌐',
    'url-path': '🔗', 'quoted-string': '💬', 'class-method': '🔧',
};

interface ShellOptions {
    readonly nonce: string;
    readonly lineText: string;
    readonly tokens: readonly AnalysisToken[];
    readonly hasSource: boolean;
    readonly frames?: readonly StackFrameInfo[];
    readonly hasTag?: boolean;
    readonly isError?: boolean;
    readonly errorHash?: string;
}

/** Build the initial progressive-loading HTML shell with spinner placeholders. */
export function buildProgressiveShell(opts: ShellOptions): string {
    const { nonce, lineText, tokens, hasSource, frames, hasTag = false, isError = false, errorHash } = opts;
    const tokenList = tokens.map(t => `<span class="token">${typeIcons[t.type] ?? '🔍'} ${escapeHtml(t.label)}</span>`).join('');
    let slots = '';
    // Error-specific sections at the top
    if (isError) {
        slots += loadingSlot('error-header', `🔍 ${t('viewer.analysis.loadingErrorClassification')}`);
        slots += loadingSlot('error-timeline', `📊 ${t('viewer.analysis.loadingErrorHistory')}`);
        slots += loadingSlot('error-occurrences', `🔁 ${t('viewer.analysis.scanningOccurrences')}`);
    }
    if (frames && frames.length > 0) { slots += renderFrameSection(frames); }
    if (hasTag) { slots += loadingSlot('related', `📋 ${t('viewer.analysis.scanningRelated')}`); }
    slots += loadingSlot('trend', `📊 ${t('viewer.analysis.checkingCrossSession')}`);
    if (hasSource) {
        slots += loadingSlot('source', `📄 ${t('viewer.analysis.analyzingSource')}`);
        slots += loadingSlot('line-history', `🕐 ${t('viewer.analysis.checkingRecentChanges')}`);
        slots += loadingSlot('imports', `📦 ${t('viewer.analysis.extractingDependencies')}`);
    }
    if (hasTag) { slots += loadingSlot('files', `📁 ${t('viewer.analysis.analyzingReferencedFiles')}`); }
    slots += loadingSlot('docs', `📚 ${t('viewer.analysis.scanningDocs')}`);
    slots += loadingSlot('symbols', `🔎 ${t('viewer.analysis.resolvingSymbols')}`);
    const searchingMsg = tokens.length > 1
        ? t('viewer.analysis.searchingTokens.many', tokens.length)
        : t('viewer.analysis.searchingTokens.one', tokens.length);
    slots += loadingSlot('tokens', `🔍 ${searchingMsg} ${tokenList}`);
    slots += loadingSlot('github', `🔗 ${t('viewer.analysis.queryingGitHub')}`);
    slots += loadingSlot('firebase', `🔥 ${t('viewer.analysis.queryingFirebase')}`);
    const errorSlots = isError ? 3 : 0; // error-header, error-timeline, error-occurrences
    // 6 = trend + docs + symbols + tokens + github + firebase
    const sectionCount = errorSlots + (hasSource ? 3 : 0) + (hasTag ? 2 : 0) + 6;
    const actionBar = isError && errorHash ? renderActionBar(errorHash, true) : '';
    return wrapHtml(nonce, `<div role="main" aria-label="${t('viewer.analysis.mainLabel')}"><div class="header"><div class="analyzed-line">${escapeHtml(lineText)}</div>
        <div class="summary"><span id="progress-text">${t('viewer.analysis.analyzingProgress', sectionCount)}</span> <button class="cancel-btn" id="cancel-btn" aria-label="${t('viewer.analysis.cancelAnalysis')}">${t('viewer.analysis.stop')}</button></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" id="progress-fill" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${sectionCount}" data-total="${sectionCount}" style="width:0%"></div></div></div>
        <div id="executive-summary"></div><div class="content">${slots}</div>${actionBar}</div>`);
}

function loadingSlot(id: string, message: string): string {
    return `<div class="section-slot" id="section-${id}"><div class="section-loading"><span class="spinner"></span> <span class="progress-msg">${message}</span></div></div>`;
}

/** Render the source + blame + diff section (replaces spinner). */
export function renderSourceSection(info: WorkspaceFileInfo, blame?: BlameLine, diff?: CommitDiff, blameCommitUrl?: string): string {
    let html = renderSourcePreview(info);
    if (blame) {
        const hashHtml = blameCommitUrl
            ? `<a class="blame-commit-link" href="${escapeHtml(blameCommitUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(blame.hash)}</a>`
            : `<code>${escapeHtml(blame.hash)}</code>`;
        html += `<div class="blame-line">${t('viewer.analysis.lastChangedBy', escapeHtml(blame.author), escapeHtml(blame.date))} · ${hashHtml} ${escapeHtml(blame.message)}</div>`;
    }
    if (diff) {
        const filesLabel = diff.filesChanged !== 1
            ? t('viewer.analysis.filesChanged.many', diff.filesChanged)
            : t('viewer.analysis.filesChanged.one', diff.filesChanged);
        html += `<div class="diff-summary">${filesLabel} · +${diff.insertions} -${diff.deletions}</div>`;
    }
    if (info.gitCommits.length > 0) {
        const commitsLabel = info.gitCommits.length !== 1
            ? t('viewer.analysis.commits.many', info.gitCommits.length)
            : t('viewer.analysis.commits.one', info.gitCommits.length);
        html += `<details class="group" open><summary class="group-header">🕐 ${t('viewer.analysis.gitHistory')} <span class="match-count">${commitsLabel}</span></summary>`;
        for (const c of info.gitCommits) {
            html += `<div class="commit-line"><span class="commit-hash">${escapeHtml(c.hash)}</span><span class="commit-date">${escapeHtml(c.date)}</span><span class="commit-msg">${escapeHtml(c.message)}</span></div>`;
        }
        html += '</details>';
    }
    if (info.annotations.length > 0) { html += renderAnnotations(info); }
    if (!html) { html = `<div class="no-matches">${t('viewer.analysis.sourceNoContext')}</div>`; }
    return doneSlot('source', html);
}

function renderSourcePreview(info: WorkspaceFileInfo): string {
    if (!info.sourcePreview) { return ''; }
    const { lines, targetLine } = info.sourcePreview;
    const uriStr = info.uri.toString();
    let html = `<details class="group" open><summary class="group-header">📄 ${t('viewer.analysis.sourceCode')} <span class="match-count">${t('viewer.analysis.lineNumber', targetLine)}</span></summary><div class="source-preview">`;
    for (const l of lines) {
        const cls = l.num === targetLine ? 'source-line target-line' : 'source-line';
        html += `<div class="${cls}" data-source-uri="${escapeHtml(uriStr)}" data-line="${l.num}"><span class="line-num">L${l.num}</span><span class="line-text">${escapeHtml(l.text)}</span></div>`;
    }
    return html + '</div></details>';
}

function renderAnnotations(info: WorkspaceFileInfo): string {
    const uriStr = info.uri.toString();
    let html = `<details class="group" open><summary class="group-header">📝 ${t('viewer.analysis.sourceAnnotations')} <span class="match-count">${t('viewer.analysis.found', info.annotations.length)}</span></summary>`;
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
    if (commits.length === 0) { return emptySlot('line-history', `🕐 ${t('viewer.analysis.noRecentChanges')}`); }
    const lhCommitsLabel = commits.length !== 1
        ? t('viewer.analysis.commits.many', commits.length)
        : t('viewer.analysis.commits.one', commits.length);
    let html = `<details class="group" open><summary class="group-header">🕐 ${t('viewer.analysis.recentChangesNearError')} <span class="match-count">${lhCommitsLabel}</span></summary>`;
    for (const c of commits) {
        html += `<div class="commit-line"><span class="commit-hash">${escapeHtml(c.hash)}</span><span class="commit-date">${escapeHtml(c.date)}</span><span class="commit-msg">${escapeHtml(c.message)}</span></div>`;
    }
    return doneSlot('line-history', html + '</details>');
}

/** Render documentation matches section. */
export function renderDocsSection(results: DocScanResults): string {
    if (results.matches.length === 0) {
        return emptySlot('docs', `📚 ${t('viewer.analysis.noDocsReferences', results.filesScanned)}`);
    }
    const docsRefLabel = results.matches.length !== 1
        ? t('viewer.analysis.docsReferences.many', results.matches.length, results.filesScanned)
        : t('viewer.analysis.docsReferences.one', results.matches.length, results.filesScanned);
    let html = `<details class="group" open><summary class="group-header">📚 ${t('viewer.analysis.projectDocumentation')} <span class="match-count">${docsRefLabel}</span></summary>`;
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
    if (results.imports.length === 0) { return emptySlot('imports', `📦 ${t('viewer.analysis.noImports')}`); }
    const summary = t('viewer.analysis.importsSummary', results.localCount, results.packageCount);
    let html = `<details class="group" open><summary class="group-header">📦 ${t('viewer.analysis.dependencies')} <span class="match-count">${t('viewer.analysis.importsCount', results.imports.length, summary)}</span></summary>`;
    for (const imp of results.imports) {
        const cls = imp.isLocal ? 'import-local' : 'import-package';
        const badge = imp.isLocal
            ? `<span class="import-badge import-badge-local">${t('viewer.analysis.badgeLocal')}</span>`
            : `<span class="import-badge import-badge-pkg">${t('viewer.analysis.badgePkg')}</span>`;
        html += `<div class="import-entry"><span class="line-num">L${imp.line}</span>${badge}<span class="${cls}">${escapeHtml(imp.module)}</span></div>`;
    }
    return doneSlot('imports', html + '</details>');
}

/** Render symbol resolution section. */
export function renderSymbolsSection(results: SymbolResults): string {
    if (results.symbols.length === 0) { return emptySlot('symbols', `🔎 ${t('viewer.analysis.noSymbols')}`); }
    let html = `<details class="group" open><summary class="group-header">🔎 ${t('viewer.analysis.symbolDefinitions')} <span class="match-count">${t('viewer.analysis.found', results.symbols.length)}</span></summary>`;
    for (const s of results.symbols) {
        const file = s.uri.fsPath.split(/[\\/]/).pop() ?? '';
        html += `<div class="symbol-entry" data-uri="${escapeHtml(s.uri.toString())}" data-line="${s.line}">
            <span class="symbol-kind">${escapeHtml(s.kind)}</span>
            <span class="symbol-name">${escapeHtml(s.name)}</span>
            <span class="symbol-loc">${escapeHtml(file)}:${s.line}</span>
            ${s.containerName ? `<span class="line-text">${t('viewer.analysis.symbolInContainer', escapeHtml(s.containerName))}</span>` : ''}</div>`;
    }
    return doneSlot('symbols', html + '</details>');
}

/** Render all token search results as a single section. */
export function renderTokenGroups(groups: TokenResultGroup[]): string {
    const total = groups.reduce((s, g) => s + g.results.matches.length, 0);
    const filesHit = new Set(groups.flatMap(g => g.results.matches.map(m => m.filename))).size;
    if (total === 0) { return emptySlot('tokens', `🔍 ${t('viewer.analysis.noSessionMatches')}`); }
    const matchSummary = total !== 1
        ? t('viewer.analysis.sessionMatchSummary.many', total, filesHit)
        : t('viewer.analysis.sessionMatchSummary.one', total, filesHit);
    let html = `<div class="summary" style="padding:4px 8px;margin-bottom:4px">${matchSummary}</div>`;
    for (const group of groups) { html += renderSingleTokenGroup(group); }
    return doneSlot('tokens', html);
}

function renderSingleTokenGroup(group: TokenResultGroup): string {
    const icon = typeIcons[group.token.type] ?? '🔍';
    const count = group.results.matches.length;
    const groupMatchLabel = count !== 1
        ? t('viewer.analysis.matchesInFiles.many', count, group.results.filesWithMatches)
        : t('viewer.analysis.matchesInFiles.one', count, group.results.filesWithMatches);
    let html = `<details class="group" ${count > 0 ? 'open' : ''}>
        <summary class="group-header">${icon} ${escapeHtml(group.token.label)} <span class="match-count">${groupMatchLabel}</span></summary>`;
    if (count === 0) {
        return html + `<div class="no-matches">${t('viewer.analysis.noMatchesOtherSessions')}</div></details>`;
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
<style nonce="${nonce}">${getAnalysisStyles()}${getAnalysisErrorStyles()}</style></head><body>${body}
<script nonce="${nonce}">${getAnalysisScript()}</script></body></html>`;
}
