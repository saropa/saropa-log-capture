/**
 * Session history panel HTML template for the webview.
 * Used by viewer-session-panel.ts.
 * Header: "Logs" plus optional " · <path>" (hidden when default folder); whole header span is clickable.
 * Includes a date-range select (1h / 4h / 24h / 7d / 30d / 3m / 6m / 1y / All time) persisted with session display options.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer-b.ts.
 */

import { t } from '../../l10n';

/** Generate the session panel HTML. */
export function getSessionPanelHtml(): string {
    return /* html */ `
<div id="session-panel" class="session-panel" role="region" aria-label="${t('viewer.session.region')}">
    <div id="session-resize" class="session-panel-resize" aria-hidden="true"></div>
    <div class="session-panel-header">
        <span id="session-header-clickable" class="session-header-clickable" title="${t('viewer.session.header.title')}">
            <span class="session-panel-title">${t('viewer.session.title')}</span>
            <span id="session-header-path" class="session-header-path" style="display:none"><span class="session-path-sep" aria-hidden="true"> · </span><span id="session-path-text"></span></span>
        </span>
        <button id="session-reset-root" class="session-panel-action" type="button" title="${t('viewer.session.resetRoot.title')}" aria-label="${t('viewer.session.resetRoot.label')}" style="display:none">
            <span class="codicon codicon-debug-restart"></span>
        </button>
        <div class="session-panel-actions">
            <button id="session-refresh" class="session-panel-action" type="button" title="${t('viewer.session.refresh.title')}" aria-label="${t('viewer.session.refresh.label')}">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="session-close" class="session-panel-close" type="button" title="${t('viewer.session.close.title')}" aria-label="${t('viewer.session.close.label')}"><span class="codicon codicon-close"></span></button>
        </div>
    </div>
    <div class="session-panel-toggles">
        <select id="session-date-range" class="session-date-range-select" title="${t('viewer.session.dateRange.title')}" aria-label="${t('viewer.session.dateRange.label')}">
            <option value="1h">${t('viewer.session.range.1h')}</option>
            <option value="4h">${t('viewer.session.range.4h')}</option>
            <option value="8h">${t('viewer.session.range.8h')}</option>
            <option value="1d">${t('viewer.session.range.1d')}</option>
            <option value="7d">${t('viewer.session.range.7d')}</option>
            <option value="30d">${t('viewer.session.range.30d')}</option>
            <option value="3m">${t('viewer.session.range.3m')}</option>
            <option value="6m">${t('viewer.session.range.6m')}</option>
            <option value="1y">${t('viewer.session.range.1y')}</option>
            <option value="all" selected>${t('viewer.session.range.all')}</option>
        </select>
        <button id="session-toggle-strip" class="session-toggle-btn" type="button" title="${t('viewer.session.toggleStrip.title')}" aria-label="${t('viewer.session.toggleStrip.label')}"><span class="codicon codicon-calendar"></span> ${t('viewer.session.toggleStrip.text')}</button>
        <button id="session-toggle-normalize" class="session-toggle-btn" type="button" title="${t('viewer.session.toggleNormalize.title')}" aria-label="${t('viewer.session.toggleNormalize.label')}"><span class="codicon codicon-edit"></span> ${t('viewer.session.toggleNormalize.text')}</button>
        <button id="session-toggle-headings" class="session-toggle-btn" type="button" title="${t('viewer.session.toggleHeadings.title')}" aria-label="${t('viewer.session.toggleHeadings.label')}"><span class="codicon codicon-list-tree"></span> ${t('viewer.session.toggleHeadings.text')}</button>
        <button id="session-toggle-reverse" class="session-toggle-btn session-sort-btn" type="button" title="${t('viewer.session.toggleReverse.title')}" aria-label="${t('viewer.session.toggleReverse.label')}"><span class="codicon codicon-sort-precedence"></span></button>
        <button id="session-toggle-latest" class="session-toggle-btn" type="button" title="${t('viewer.session.toggleLatest.title')}" aria-label="${t('viewer.session.toggleLatest.label')}"><span class="codicon codicon-pinned"></span> ${t('viewer.session.toggleLatest.text')}</button>
        <button id="session-filter-tags" class="session-toggle-btn" type="button" title="${t('viewer.session.filterTags.title')}" aria-label="${t('viewer.session.filterTags.label')}"><span class="codicon codicon-filter"></span> ${t('viewer.session.filterTags.text')}</button>
    </div>
    <div id="session-tags-section" class="session-tags-section" style="display:none">
        <div id="session-tag-chips" class="session-tag-chips"></div>
    </div>
    <div id="session-name-filter-bar" class="session-name-filter-bar" style="display:none" aria-live="polite"></div>
    <div class="session-panel-content">
        <div id="session-list"></div>
        <div id="session-list-pagination" class="session-list-pagination" style="display:none" aria-label="${t('viewer.session.pagination.label')}"></div>
        <div id="session-empty" class="session-empty">${t('viewer.session.empty')}</div>
        <div id="session-loading" class="session-loading" style="display:none">
            <div class="session-loading-bar"><div class="session-loading-bar-fill"></div></div>
            <div id="session-loading-label" class="session-loading-label">${t('viewer.session.loading')}</div>
            <div class="session-loading-shimmer">
                <div class="session-shimmer-line"></div>
                <div class="session-shimmer-line"></div>
                <div class="session-shimmer-line"></div>
                <div class="session-shimmer-line session-shimmer-line-short"></div>
            </div>
        </div>
    </div>
</div>`;
}
