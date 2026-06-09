/**
 * Session history panel HTML template for the webview.
 * Used by viewer-session-panel.ts.
 * Header: "Logs" plus optional " · <path>" (hidden when default folder); whole header span is clickable.
 * Includes a date-range select (1h / 4h / 24h / 7d / 30d / 3m / 6m / 1y / All time) persisted with session display options.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer-b.ts.
 */

import { t } from '../../l10n';

/* One toggle row inside the kebab options menu. Button ids stay identical to
   the prior toolbar so existing syncToggleButtons/bindToggle wiring keeps
   working without code changes. */
function renderOptionToggle(buttonId: string, codicon: string, key: string): string {
    const title = t(`viewer.session.${key}.title`);
    const label = t(`viewer.session.${key}.label`);
    const text = t(`viewer.session.${key}.text`);
    return `<button id="${buttonId}" class="session-options-toggle" type="button" role="menuitemcheckbox" aria-checked="false" title="${title}" aria-label="${label}">
            <span class="session-options-toggle-icon codicon codicon-${codicon}"></span>
            <span class="session-options-toggle-text">${text}</span>
            <span class="session-options-toggle-switch" aria-hidden="true"><span class="session-options-toggle-thumb"></span></span>
        </button>`;
}

/** Generate the session panel HTML. */
export function getSessionPanelHtml(): string {
    return /* html */ `
<div id="session-panel" class="session-panel" role="region" aria-label="${t('viewer.session.region')}">
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
            <button id="session-options-toggle" class="session-panel-action" type="button" title="${t('viewer.session.options.title')}" aria-label="${t('viewer.session.options.label')}" aria-haspopup="true" aria-expanded="false">
                <span class="codicon codicon-kebab-vertical"></span>
            </button>
            <button id="session-close" class="session-panel-close" type="button" title="${t('viewer.session.close.title')}" aria-label="${t('viewer.session.close.label')}"><span class="codicon codicon-close"></span></button>
        </div>
        <!-- Display options popover. The previous toolbar row hid the Tags filter on
             narrow panels because the buttons overflowed; consolidating them here
             frees the header row and makes every option scannable in one place.
             MUST stay nested inside .session-panel-header — that header carries the
             position:relative anchor that makes top:100% land below the header.
             A sibling placement (the original layout) fell through to the initial
             containing block, and .session-panel { overflow:hidden } then clipped
             the popover entirely so clicking the kebab appeared to do nothing. -->
        <div id="session-options-menu" class="session-options-menu" role="menu" aria-label="${t('viewer.session.options.label')}">
        <div class="session-options-row">
            <label class="session-options-row-label" for="session-date-range">${t('viewer.session.dateRange.label')}</label>
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
        </div>
        ${renderOptionToggle('session-toggle-strip', 'calendar', 'toggleStrip')}
        ${renderOptionToggle('session-toggle-normalize', 'edit', 'toggleNormalize')}
        ${renderOptionToggle('session-toggle-headings', 'list-tree', 'toggleHeadings')}
        ${renderOptionToggle('session-toggle-reverse', 'sort-precedence', 'toggleReverse')}
        ${renderOptionToggle('session-toggle-latest', 'pinned', 'toggleLatest')}
        ${renderOptionToggle('session-filter-tags', 'filter', 'filterTags')}
        <hr class="session-options-sep" />
        <button id="session-export-list" type="button" class="session-options-action" role="menuitem" title="${t('viewer.session.exportList.title')}" aria-label="${t('viewer.session.exportList.label')}">
            <span class="codicon codicon-save"></span>
            <span class="session-options-action-text">${t('viewer.session.exportList.text')}</span>
        </button>
        <hr class="session-options-sep" />
        <button id="session-open-file" type="button" class="session-options-action" role="menuitem" title="${t('viewer.session.openFile.title')}" aria-label="${t('viewer.session.openFile.label')}">
            <span class="codicon codicon-folder-opened"></span>
            <span class="session-options-action-text">${t('viewer.session.openFile.text')}</span>
        </button>
        </div>
    </div>
    <div id="session-tags-section" class="session-tags-section" style="display:none">
        <div id="session-tag-chips" class="session-tag-chips"></div>
    </div>
    <div id="session-name-filter-bar" class="session-name-filter-bar" style="display:none" aria-live="polite"></div>
    <!-- Sticky newer-log banner. Sits between the toolbar/name-filter and the day list so
         scrolling the list doesn't hide it. Hidden by default; renderNewerLogBanner() flips
         display when any rendered record carries unreadSinceFocus:true. Plan: 001. -->
    <div id="session-newer-banner" class="session-newer-banner" style="display:none" role="status" aria-live="polite"></div>
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
