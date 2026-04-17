"use strict";
/**
 * Investigation Panel HTML
 *
 * HTML generation functions for the investigation panel webview.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSourceItem = renderSourceItem;
exports.buildInvestigationHtml = buildInvestigationHtml;
exports.buildNoInvestigationHtml = buildNoInvestigationHtml;
const l10n_1 = require("../../l10n");
const ansi_1 = require("../../modules/capture/ansi");
const viewer_content_1 = require("../provider/viewer-content");
const investigation_panel_styles_1 = require("./investigation-panel-styles");
const investigation_panel_script_1 = require("./investigation-panel-script");
const investigation_panel_handlers_1 = require("./investigation-panel-handlers");
function renderSourceItem(source, isMissing = false) {
    const icon = source.type === 'session' ? '📄' : '📎';
    const typeLabel = source.type === 'session' ? 'session' : 'file';
    const missingClass = isMissing ? ' source-missing' : '';
    const missingIcon = isMissing ? '<span class="source-warning" title="' + (0, l10n_1.t)('msg.sourceFileMissing') + '">⚠️</span>' : '';
    return `<div class="source-item${missingClass}" data-path="${(0, ansi_1.escapeHtml)(source.relativePath)}">
    <span class="source-icon">${icon}</span>
    ${missingIcon}
    <span class="source-label">${(0, ansi_1.escapeHtml)(source.label)}</span>
    <span class="source-type">${typeLabel}</span>
    <button class="unpin-btn" data-path="${(0, ansi_1.escapeHtml)(source.relativePath)}" title="${(0, l10n_1.t)('action.unpin')}">✕</button>
</div>`;
}
function buildInvestigationHtml(inv, missingSources = []) {
    const nonce = (0, viewer_content_1.getNonce)();
    const missingSet = new Set(missingSources);
    const sourcesHtml = inv.sources.length > 0
        ? inv.sources.map(s => renderSourceItem(s, missingSet.has(s.relativePath))).join('')
        : `<div class="empty-sources">${(0, l10n_1.t)('msg.noSourcesPinned')}</div>`;
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${(0, investigation_panel_styles_1.getInvestigationPanelStyles)()}</style>
</head><body>
<div role="main" aria-label="Investigation">
<div class="header">
    <div class="header-left">
        <div class="title"><span class="title-icon" aria-hidden="true">🔍</span>${(0, ansi_1.escapeHtml)(inv.name)}</div>
        <div class="subtitle">${(0, l10n_1.t)('msg.investigationSources', String(inv.sources.length))}</div>
    </div>
    <div class="header-right">
        <button class="close-btn" title="${(0, l10n_1.t)('action.closeInvestigation')}" aria-label="${(0, l10n_1.t)('action.closeInvestigation')}">✕</button>
    </div>
</div>
<div class="content">
    <div class="section">
        <div class="section-title"><span aria-hidden="true">📌</span> ${(0, l10n_1.t)('label.pinnedSources')} <button class="btn btn-secondary add-source-btn">+ ${(0, l10n_1.t)('action.add')}</button></div>
        <div class="sources-list">${sourcesHtml}</div>
    </div>
    <div class="search-section">
        <div class="search-box">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input type="text" class="search-input" placeholder="${(0, l10n_1.t)('placeholder.searchSources')}" aria-label="${(0, l10n_1.t)('placeholder.searchSources')}" value="${(0, ansi_1.escapeHtml)(inv.lastSearchQuery ?? '')}">
            <button class="search-history-btn" title="${(0, l10n_1.t)('action.searchHistory')}" aria-label="${(0, l10n_1.t)('action.searchHistory')}">▾</button>
            <button class="search-options-btn" title="${(0, l10n_1.t)('action.searchOptions')}" aria-label="${(0, l10n_1.t)('action.searchOptions')}">⚙</button>
            <button class="search-clear" title="${(0, l10n_1.t)('action.clear')}" aria-label="${(0, l10n_1.t)('action.clear')}">✕</button>
        </div>
        <div class="search-history-dropdown hidden"></div>
        <div class="search-options hidden">
            <label class="search-option">
                <input type="checkbox" class="option-case-sensitive">
                <span>${(0, l10n_1.t)('label.caseSensitive')}</span>
            </label>
            <label class="search-option">
                <input type="checkbox" class="option-use-regex">
                <span>${(0, l10n_1.t)('label.useRegex')}</span>
            </label>
            <label class="search-option">
                <span>${(0, l10n_1.t)('label.contextLines')}</span>
                <input type="number" class="option-context-lines" value="2" min="0" max="10">
            </label>
        </div>
        <div class="search-progress hidden">
            <div class="progress-bar"><div class="progress-fill"></div></div>
            <span class="progress-text"></span>
        </div>
    </div>
    <div class="results-section">
        <div class="results-content">${inv.lastSearchQuery ? `<div class="loading"><div class="spinner"></div>${(0, l10n_1.t)('msg.searching')}</div>` : (0, investigation_panel_handlers_1.renderEmptyResults)()}</div>
    </div>
    <div class="section notes-section">
        <div class="section-title">📝 ${(0, l10n_1.t)('label.notes')}</div>
        <textarea class="notes-textarea" placeholder="${(0, l10n_1.t)('placeholder.investigationNotes')}">${(0, ansi_1.escapeHtml)(inv.notes ?? '')}</textarea>
    </div>
</div>
<div class="actions-bar">
    <button class="btn open-slc-btn">📥 ${(0, l10n_1.t)('action.openSlcFile')}</button>
    <button class="btn share-btn">📤 ${(0, l10n_1.t)('action.shareInvestigation')}</button>
    <button class="btn export-btn">📦 ${(0, l10n_1.t)('action.exportSlc')}</button>
    <button class="btn report-btn">📋 ${(0, l10n_1.t)('action.generateBugReport')}</button>
</div>
</div>
<script nonce="${nonce}">${(0, investigation_panel_script_1.getInvestigationPanelScript)()}</script>
</body></html>`;
}
function buildNoInvestigationHtml() {
    const nonce = (0, viewer_content_1.getNonce)();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${(0, investigation_panel_styles_1.getInvestigationPanelStyles)()}</style>
</head><body>
<div class="no-investigation">
    <div class="no-investigation-icon">🔍</div>
    <div class="no-investigation-title">${(0, l10n_1.t)('title.noActiveInvestigation')}</div>
    <div class="no-investigation-text">${(0, l10n_1.t)('msg.noActiveInvestigationDesc')}</div>
    <button class="btn create-btn">+ ${(0, l10n_1.t)('action.createInvestigation')}</button>
    <button class="btn open-slc-btn">📥 ${(0, l10n_1.t)('action.openSlcFile')}</button>
</div>
<script nonce="${nonce}">${(0, investigation_panel_script_1.getInvestigationPanelScript)()}</script>
</body></html>`;
}
//# sourceMappingURL=investigation-panel-html.js.map