/**
 * Filter panel HTML — full-height slide-out panel in the panel-slot.
 *
 * Opened by the toolbar filter button via setActivePanel('filters').
 * Layout: levels row at top, then vertical tab sidebar (left) with
 * panel content area (right).
 *
 * Tabs: Log Sources, Exclusions, File Scope, Message Tags, Source Classes,
 * SQL Commands. Each has an icon, toggleable label, and count suffix.
 * Click tab bar whitespace to toggle labels (persisted in webview state).
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer.ts.
 * Emoji glyphs and the ±N context indicator stay literal (symbolic, not localized).
 */

import { t } from '../../l10n';

/** One level toggle circle. Emoji glyph stays symbolic; title/aria/label localize. */
function levelCircle(level: string, emoji: string, labelKey: string): string {
    return `<button id="level-${level}-toggle" class="level-circle active" title="${t('viewer.drawer.levelDot.' + level + '.title')}" aria-label="${t('viewer.drawer.levelToggle.' + level)}"><span class="level-emoji">${emoji}</span><span class="level-label">${t(labelKey)}</span><span class="level-count"></span></button>`;
}

/** One source-tier radio. Visible label derives from value (radio.all/warnplus/none),
    keeping the signature within the 4-parameter limit. */
function tierRadio(name: string, value: string, titleKey: string, checked: boolean): string {
    return `<label title="${t(titleKey)}"><input type="radio" name="tier-${name}" value="${value}"${checked ? ' checked' : ''} /> ${t('viewer.drawer.radio.' + value)}</label>`;
}

/** Filter panel HTML — inserted into #panel-slot. */
export function getFilterDrawerHtml(): string {
    return /* html */ `
<div id="filters-panel" class="filters-panel" role="region" aria-label="${t('viewer.drawer.region')}">
    <div class="filters-panel-header">
        <span>${t('viewer.drawer.header')}</span>
        <button class="filters-panel-close" type="button" title="${t('viewer.drawer.close.title')}" aria-label="${t('viewer.drawer.close.label')}">
            <span class="codicon codicon-close"></span>
        </button>
    </div>

    <!-- Levels row -->
    <div class="filter-drawer-levels">
        <div class="filter-drawer-level-row">
            <div class="level-flyup-header">
                <button type="button" id="level-select-all" class="active" title="${t('viewer.drawer.selectAll.title')}">${t('viewer.drawer.selectAll')}</button>
                <button type="button" id="level-select-none" title="${t('viewer.drawer.selectNone.title')}">${t('viewer.drawer.selectNone')}</button>
            </div>
            ${levelCircle('error', '🔴', 'viewer.level.error')}
            ${levelCircle('warning', '🟠', 'viewer.level.warning')}
            ${levelCircle('info', '🟢', 'viewer.level.info')}
            ${levelCircle('performance', '🟣', 'viewer.drawer.levelLabel.perf')}
            ${levelCircle('todo', '⚪', 'viewer.level.todo')}
            ${levelCircle('notice', '🟦', 'viewer.level.notice')}
            ${levelCircle('debug', '🟤', 'viewer.level.debug')}
            ${levelCircle('database', '🟡', 'viewer.drawer.levelLabel.db')}
            <span class="filter-drawer-context" title="${t('viewer.drawer.context.title')}">
                <span id="context-lines-label">±3</span>
                <input type="range" id="context-lines-slider" min="0" max="10" value="3" title="${t('viewer.drawer.context.title')}" aria-label="${t('viewer.drawer.context.label')}" />
            </span>
        </div>
    </div>

    <!-- Vertical tab sidebar (left) + panel content (right) -->
    <div class="filter-tab-layout">
        <div class="filter-tab-bar" role="tablist" aria-label="${t('viewer.drawer.tabBar.label')}"
             title="${t('viewer.drawer.tabBar.title')}">
            ${getFilterTabs()}
        </div>
        <div class="filter-tab-panels">
            ${getFilterTabPanels()}
        </div>
    </div>

    <!-- Hidden preset select — kept for backward compat with presets script -->
    <select id="preset-select" class="u-hidden" aria-hidden="true">
        <option value="">${t('viewer.drawer.presetDefault')}</option>
    </select>
    <span id="filter-drawer-summary" class="filter-drawer-summary u-hidden" aria-hidden="true"></span>
</div>`;
}

/** Tab buttons — each with a codicon, label, and count suffix span. */
function getFilterTabs(): string {
    return /* html */ `
        ${filterTab('log-sources', 'broadcast', 'viewer.drawer.tab.logSources')}
        ${filterTab('exclusions', 'exclude', 'viewer.drawer.tab.exclusions')}
        ${filterTab('scope', 'folder-opened', 'viewer.drawer.tab.scope')}
        ${filterTab('log-tags', 'tag', 'viewer.drawer.tab.logTags')}
        ${filterTab('class-tags', 'symbol-class', 'viewer.drawer.tab.classTags')}
        ${filterTab('sql-patterns', 'database', 'viewer.drawer.tab.sqlPatterns')}`;
}

/** Single tab button with icon, label, and count. */
function filterTab(id: string, icon: string, labelKey: string): string {
    const label = t(labelKey);
    return /* html */ `
    <button type="button" class="filter-tab" id="filter-tab-${id}"
            role="tab" aria-selected="false"
            aria-controls="${id}-section"
            title="${label}">
        <span class="codicon codicon-${icon}"></span>
        <span class="filter-tab-label">${label}</span>
        <span class="filter-tab-count" id="filter-tab-count-${id}"></span>
    </button>`;
}

/** Tab panel content — each panel wraps the section body. */
function getFilterTabPanels(): string {
    return /* html */ `
    <div class="filter-tab-panel" id="log-sources-section" role="tabpanel" style="display:none">
        <div class="options-row-list tier-filter-list">
            <fieldset class="tier-radio-group">
                <legend title="${t('viewer.drawer.dap.legendTitle')}">${t('viewer.drawer.dap.legendText')} <span class="tier-hint">${t('viewer.drawer.dap.legendHint')}</span></legend>
                ${tierRadio('flutter', 'all', 'viewer.drawer.dap.all.title',true)}
                ${tierRadio('flutter', 'warnplus', 'viewer.drawer.dap.warnplus.title',false)}
                ${tierRadio('flutter', 'none', 'viewer.drawer.dap.none.title',false)}
            </fieldset>
            <fieldset class="tier-radio-group tier-radio-group-spaced">
                <legend>${t('viewer.drawer.device.legendText')} <span class="tier-hint">${t('viewer.drawer.device.legendHint')}</span></legend>
                ${tierRadio('device', 'all', 'viewer.drawer.device.all.title',false)}
                ${tierRadio('device', 'warnplus', 'viewer.drawer.device.warnplus.title',true)}
                ${tierRadio('device', 'none', 'viewer.drawer.device.none.title',false)}
            </fieldset>
            <fieldset class="tier-radio-group tier-radio-group-spaced">
                <legend>${t('viewer.drawer.external.legendText')} <span class="tier-hint">${t('viewer.drawer.external.legendHint')}</span></legend>
                ${tierRadio('external', 'all', 'viewer.drawer.external.all.title',false)}
                ${tierRadio('external', 'warnplus', 'viewer.drawer.external.warnplus.title',true)}
                ${tierRadio('external', 'none', 'viewer.drawer.external.none.title',false)}
            </fieldset>
        </div>
    </div>
    <div class="filter-tab-panel" id="exclusions-section" role="tabpanel" style="display:none">
        <div class="exclusion-input-wrapper">
            <label class="exclusion-toggle" title="${t('viewer.drawer.exclusion.toggle.title')}"><input type="checkbox" id="opt-exclusions" /><span id="exclusion-label" class="u-sr-only">${t('viewer.drawer.exclusion.srLabel')}</span></label>
            <input id="exclusion-add-input" type="text" placeholder="${t('viewer.drawer.exclusion.placeholder')}" title="${t('viewer.drawer.exclusion.input.title')}" />
            <button id="exclusion-add-btn" title="${t('viewer.drawer.exclusion.add.title')}">${t('viewer.drawer.exclusion.add')}</button>
        </div>
        <div id="exclusion-chips" class="exclusion-chips"></div>
        <div class="options-hint" id="exclusion-count"></div>
    </div>
    <div class="filter-tab-panel" id="scope-section" role="tabpanel" style="display:none">
        <div id="scope-status" class="options-hint"></div>
        <label class="options-row" title="${t('viewer.drawer.scope.all.title')}"><input type="radio" name="scope" value="all" checked /> ${t('viewer.drawer.scope.all')}</label>
        <label class="options-row" title="${t('viewer.drawer.scope.workspace.title')}"><input type="radio" name="scope" value="workspace" disabled /> ${t('viewer.drawer.scope.workspace')}<span id="scope-suffix-workspace" class="scope-suffix"></span></label>
        <label class="options-row" title="${t('viewer.drawer.scope.package.title')}"><input type="radio" name="scope" value="package" disabled /> ${t('viewer.drawer.scope.package')}<span id="scope-suffix-package" class="scope-suffix"></span></label>
        <label class="options-row" title="${t('viewer.drawer.scope.directory.title')}"><input type="radio" name="scope" value="directory" disabled /> ${t('viewer.drawer.scope.directory')}<span id="scope-suffix-directory" class="scope-suffix"></span></label>
        <label class="options-row" title="${t('viewer.drawer.scope.file.title')}"><input type="radio" name="scope" value="file" disabled /> ${t('viewer.drawer.scope.file')}<span id="scope-suffix-file" class="scope-suffix"></span></label>
        <label class="options-row scope-unattrib-row" title="${t('viewer.drawer.scope.unattrib.title')}"><input type="checkbox" id="scope-hide-unattrib" /><span>${t('viewer.drawer.scope.unattrib')}</span></label>
        <div id="scope-filter-hint" class="options-hint scope-filter-hint" style="display:none" aria-live="polite"></div>
    </div>
    <div class="filter-tab-panel" id="log-tags-section" role="tabpanel" style="display:none">
        <div class="options-hint">${t('viewer.drawer.logTags.hint')}</div>
        <div class="options-row">
            <span id="source-tag-summary" class="source-tag-summary"></span>
        </div>
        <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
    </div>
    <div class="filter-tab-panel" id="class-tags-section" role="tabpanel" style="display:none">
        <div class="options-hint">${t('viewer.drawer.classTags.hint')}</div>
        <div class="options-row">
            <span id="class-tag-summary" class="source-tag-summary"></span>
        </div>
        <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
    </div>
    <div class="filter-tab-panel" id="sql-patterns-section" role="tabpanel" style="display:none">
        <div class="options-row">
            <span id="sql-pattern-summary" class="source-tag-summary"></span>
        </div>
        <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
        <div class="options-row">
            <label title="${t('viewer.drawer.sql.markers.title')}">
                <input type="checkbox" id="opt-db-signal-markers" checked />
                ${t('viewer.drawer.sql.markers')}
            </label>
        </div>
        <div class="options-row">
            <button type="button" id="open-sql-query-history-from-tags" class="options-action-btn" title="${t('viewer.drawer.sql.history.title')}">${t('viewer.drawer.sql.history')}</button>
        </div>
    </div>`;
}
