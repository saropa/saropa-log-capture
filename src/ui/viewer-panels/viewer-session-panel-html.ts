/**
 * Session history panel HTML template for the webview.
 * Used by viewer-session-panel.ts.
 * Header: "Logs" plus optional " · <path>" (hidden when default folder); whole header span is clickable.
 * Includes a date-range select (1h / 4h / 24h / 7d / 30d / 3m / 6m / 1y / All time) and a
 * minimum-size select (Any / >25 KB / >50 KB / >100 KB / >500 KB / >1 MB / >5 MB / >10 MB / >50 MB), both persisted with session display options.
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

/* A grouped submenu inside the kebab menu. Reuses the .context-menu-submenu flyout pattern (already
   styled for the session context menu in this panel) so the top-level menu stays short on narrow/short
   panels; positionSessionOptionsSubmenu() (options-menu script) places the flyout in viewport
   coordinates so it can never be cropped. `inner` is the flyout's row markup. */
function renderOptionsSubmenu(
    codicon: string,
    labelKey: string,
    inner: string,
    opts?: { id?: string; indicator?: boolean },
): string {
    const label = t(labelKey);
    const idAttr = opts?.id ? ` id="${opts.id}"` : '';
    // A dot the JS lights (.has-active-filters on the trigger) when this group holds an active
    // setting — used on the Filter group so an applied date/size filter is visible at the group it
    // lives under, not just on the kebab. Hidden by default via CSS.
    const dot = opts?.indicator ? '<span class="session-options-filter-dot" aria-hidden="true"></span>' : '';
    return `<div${idAttr} class="context-menu-submenu session-options-submenu" role="menuitem" aria-haspopup="true" tabindex="0" aria-label="${label}">
            <span class="codicon codicon-${codicon}"></span>
            <span class="session-options-submenu-label">${label}</span>
            ${dot}
            <span class="context-menu-arrow codicon codicon-chevron-right"></span>
            <div class="context-menu-submenu-content session-options-submenu-content">${inner}</div>
        </div>`;
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
        ${renderOptionsSubmenu('filter', 'viewer.session.group.filter', `
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
            <div class="session-options-row">
                <label class="session-options-row-label" for="session-size-range">${t('viewer.session.sizeRange.label')}</label>
                <select id="session-size-range" class="session-date-range-select" title="${t('viewer.session.sizeRange.title')}" aria-label="${t('viewer.session.sizeRange.label')}">
                    <option value="all" selected>${t('viewer.session.size.all')}</option>
                    <option value="25k">${t('viewer.session.size.25k')}</option>
                    <option value="50k">${t('viewer.session.size.50k')}</option>
                    <option value="100k">${t('viewer.session.size.100k')}</option>
                    <option value="500k">${t('viewer.session.size.500k')}</option>
                    <option value="1m">${t('viewer.session.size.1m')}</option>
                    <option value="5m">${t('viewer.session.size.5m')}</option>
                    <option value="10m">${t('viewer.session.size.10m')}</option>
                    <option value="50m">${t('viewer.session.size.50m')}</option>
                </select>
            </div>
            ${renderOptionToggle('session-filter-tags', 'filter', 'filterTags')}`, { id: 'session-filter-group', indicator: true })}
        ${renderOptionsSubmenu('settings-gear', 'viewer.session.group.display', `
            ${renderOptionToggle('session-toggle-strip', 'calendar', 'toggleStrip')}
            ${renderOptionToggle('session-toggle-normalize', 'edit', 'toggleNormalize')}
            ${renderOptionToggle('session-toggle-headings', 'list-tree', 'toggleHeadings')}
            ${renderOptionToggle('session-toggle-reverse', 'sort-precedence', 'toggleReverse')}
            ${renderOptionToggle('session-toggle-latest', 'pinned', 'toggleLatest')}`)}
        <hr class="session-options-sep" />
        ${renderOptionsSubmenu('list-unordered', 'viewer.session.group.actions', `
            <button id="session-export-list" type="button" class="session-options-action" role="menuitem" title="${t('viewer.session.exportList.title')}" aria-label="${t('viewer.session.exportList.label')}">
                <span class="codicon codicon-save"></span>
                <span class="session-options-action-text">${t('viewer.session.exportList.text')}</span>
            </button>
            <button id="session-open-file" type="button" class="session-options-action" role="menuitem" title="${t('viewer.session.openFile.title')}" aria-label="${t('viewer.session.openFile.label')}">
                <span class="codicon codicon-folder-opened"></span>
                <span class="session-options-action-text">${t('viewer.session.openFile.text')}</span>
            </button>
            <button id="session-open-url" type="button" class="session-options-action" role="menuitem" title="${t('viewer.session.openUrl.title')}" aria-label="${t('viewer.session.openUrl.label')}">
                <span class="codicon codicon-cloud-download"></span>
                <span class="session-options-action-text">${t('viewer.session.openUrl.text')}</span>
            </button>`)}
        <hr class="session-options-sep" />
        <!-- Recently-opened-files shortcut list. Populated client-side by renderLoadedFilesMenu()
             from the session records flagged loadedManually (files opened via the Open Log File /
             URL pickers, which the directory scan can't surface). Capped at the 10 most recent by
             load time so a user can re-open an out-of-folder log without re-browsing for it. The
             empty notice shows until the first manual open records a row. -->
        <div class="session-loaded-files" role="group" aria-label="${t('viewer.session.loadedFiles.aria')}">
            <div id="session-loaded-files-empty" class="session-loaded-files-empty">${t('viewer.session.loadedFiles.empty')}</div>
            <div id="session-loaded-files-list" class="session-loaded-files-list"></div>
        </div>
        </div>
    </div>
    <div id="session-tags-section" class="session-tags-section" style="display:none">
        <div id="session-tag-chips" class="session-tag-chips"></div>
    </div>
    <div id="session-name-filter-bar" class="session-name-filter-bar" style="display:none" aria-live="polite"></div>
    <!-- The newer-log banner used to live here. It now renders only on the log-viewer surface
         (#viewer-newer-banner in viewer-content-body.ts) so the alert is visible without opening
         this panel and never shows twice at once (BUG_new_log_banner). -->
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
