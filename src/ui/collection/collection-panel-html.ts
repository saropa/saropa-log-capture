/**
 * Investigation Panel HTML
 *
 * HTML generation functions for the investigation panel webview.
 */

import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import { getNonce } from '../provider/viewer-content';
import { getInvestigationPanelStyles } from './investigation-panel-styles';
import { getInvestigationPanelScript } from './investigation-panel-script';
import type { Investigation, InvestigationSource } from '../../modules/investigation/investigation-types';
import { renderEmptyResults } from './investigation-panel-handlers';

export function renderSourceItem(source: InvestigationSource, isMissing: boolean = false): string {
    const icon = source.type === 'session' ? '📄' : '📎';
    const typeLabel = source.type === 'session' ? 'session' : 'file';
    const missingClass = isMissing ? ' source-missing' : '';
    const missingIcon = isMissing ? '<span class="source-warning" title="' + t('msg.sourceFileMissing') + '">⚠️</span>' : '';
    return `<div class="source-item${missingClass}" data-path="${escapeHtml(source.relativePath)}">
    <span class="source-icon">${icon}</span>
    ${missingIcon}
    <span class="source-label">${escapeHtml(source.label)}</span>
    <span class="source-type">${typeLabel}</span>
    <button class="unpin-btn" data-path="${escapeHtml(source.relativePath)}" title="${t('action.unpin')}">✕</button>
</div>`;
}

export function buildInvestigationHtml(inv: Investigation, missingSources: string[] = []): string {
    const nonce = getNonce();
    const missingSet = new Set(missingSources);
    const sourcesHtml = inv.sources.length > 0
        ? inv.sources.map(s => renderSourceItem(s, missingSet.has(s.relativePath))).join('')
        : `<div class="empty-sources">${t('msg.noSourcesPinned')}</div>`;

    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getInvestigationPanelStyles()}</style>
</head><body>
<div role="main" aria-label="Investigation">
<div class="header">
    <div class="header-left">
        <div class="title"><span class="title-icon" aria-hidden="true">🔍</span>${escapeHtml(inv.name)}</div>
        <div class="subtitle">${t('msg.investigationSources', String(inv.sources.length))}</div>
    </div>
    <div class="header-right">
        <button class="close-btn" title="${t('action.closeInvestigation')}" aria-label="${t('action.closeInvestigation')}">✕</button>
    </div>
</div>
<div class="content">
    <div class="section">
        <div class="section-title"><span aria-hidden="true">📌</span> ${t('label.pinnedSources')} <button class="btn btn-secondary add-source-btn">+ ${t('action.add')}</button></div>
        <div class="sources-list">${sourcesHtml}</div>
    </div>
    <div class="search-section">
        <div class="search-box">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input type="text" class="search-input" placeholder="${t('placeholder.searchSources')}" aria-label="${t('placeholder.searchSources')}" value="${escapeHtml(inv.lastSearchQuery ?? '')}">
            <button class="search-history-btn" title="${t('action.searchHistory')}" aria-label="${t('action.searchHistory')}">▾</button>
            <button class="search-options-btn" title="${t('action.searchOptions')}" aria-label="${t('action.searchOptions')}">⚙</button>
            <button class="search-clear" title="${t('action.clear')}" aria-label="${t('action.clear')}">✕</button>
        </div>
        <div class="search-history-dropdown hidden"></div>
        <div class="search-options hidden">
            <label class="search-option">
                <input type="checkbox" class="option-case-sensitive">
                <span>${t('label.caseSensitive')}</span>
            </label>
            <label class="search-option">
                <input type="checkbox" class="option-use-regex">
                <span>${t('label.useRegex')}</span>
            </label>
            <label class="search-option">
                <span>${t('label.contextLines')}</span>
                <input type="number" class="option-context-lines" value="2" min="0" max="10">
            </label>
        </div>
        <div class="search-progress hidden">
            <div class="progress-bar"><div class="progress-fill"></div></div>
            <span class="progress-text"></span>
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
    <button class="btn open-slc-btn">📥 ${t('action.openSlcFile')}</button>
    <button class="btn share-btn">📤 ${t('action.shareInvestigation')}</button>
    <button class="btn export-btn">📦 ${t('action.exportSlc')}</button>
    <button class="btn report-btn">📋 ${t('action.generateBugReport')}</button>
</div>
</div>
<script nonce="${nonce}">${getInvestigationPanelScript()}</script>
</body></html>`;
}

export function buildNoInvestigationHtml(): string {
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
    <button class="btn open-slc-btn">📥 ${t('action.openSlcFile')}</button>
</div>
<script nonce="${nonce}">${getInvestigationPanelScript()}</script>
</body></html>`;
}
