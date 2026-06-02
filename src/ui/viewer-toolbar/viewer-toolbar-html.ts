/**
 * Toolbar HTML for the log viewer webview.
 *
 * Replaces the session-nav header and footer with a single persistent bar.
 * Fixed-width elements (nav, icons, level dots, line count) sit left;
 * the variable-width filename fills remaining space on the right with ellipsis.
 *
 * Element IDs preserved from the old footer/header so existing scripts
 * continue to work without changes:
 *   `#level-menu-btn`, `#line-count`, `#hidden-lines-counter`,
 *   `#footer-selection`, `#footer-text`.
 */

import { getRunNavHtml } from '../viewer-nav/viewer-run-nav';
import { t } from '../../l10n';

export interface ToolbarHtmlOptions {
    readonly version: string;
}

/** One severity dot-group cell. Glyph (E/W/…) stays symbolic; title + aria-label localize. */
function levelDot(level: string, glyph: string): string {
    return `<span class="level-dot-group" data-level="${level}" title="${t('viewer.toolbar.levelDot.' + level + '.title')}" role="img" aria-label="${t('viewer.level.' + level)}"><span class="level-dot active level-dot-${level}"></span><span class="level-letter level-letter-${level}">${glyph}</span><span class="dot-count"></span></span>`;
}

/** Toolbar HTML: nav arrows, icons, level dots, line count, filename. */
export function getToolbarHtml(opts: ToolbarHtmlOptions): string {
    const ver = opts.version ? `v${opts.version}` : '';
    return /* html */ `
<div id="viewer-toolbar" class="viewer-toolbar" role="toolbar" aria-label="${t('viewer.toolbar.label')}" data-version="${ver}">
    <div class="toolbar-left">
        <button type="button" id="session-prev" class="toolbar-icon-btn" title="${t('viewer.toolbar.prevSession.title')}" aria-label="${t('viewer.toolbar.prevSession.label')}" disabled>
            <span class="codicon codicon-chevron-left" aria-hidden="true"></span>
        </button>
        <span class="nav-bar-label" title="${t('viewer.toolbar.sessionPos.title')}">${t('viewer.toolbar.sessionLog')} <span id="session-nav-current">1</span> ${t('viewer.toolbar.sessionOf')} <span id="session-nav-total">1</span></span>
        <button type="button" id="session-next" class="toolbar-icon-btn" title="${t('viewer.toolbar.nextSession.title')}" aria-label="${t('viewer.toolbar.nextSession.label')}" disabled>
            <span class="codicon codicon-chevron-right" aria-hidden="true"></span>
        </button>
        ${getRunNavHtml()}
        <span class="toolbar-sep"></span>
        <button type="button" id="toolbar-search-btn" class="toolbar-icon-btn" title="${t('viewer.toolbar.search.title')}" aria-label="${t('viewer.toolbar.search.label')}" aria-expanded="false">
            <span class="codicon codicon-search" aria-hidden="true"></span>
            <span id="toolbar-search-count" class="toolbar-badge" title="${t('viewer.toolbar.searchCount.title')}"></span>
        </button>
        <button type="button" id="toolbar-filter-btn" class="toolbar-icon-btn" title="${t('viewer.toolbar.filter.title')}" aria-label="${t('viewer.toolbar.filter.label')}" aria-expanded="false">
            <span class="codicon codicon-filter" aria-hidden="true"></span>
            <span id="toolbar-filter-count" class="toolbar-badge" title="${t('viewer.toolbar.filterCount.title')}"></span>
        </button>
        <button type="button" id="toolbar-signals-btn" class="toolbar-icon-btn" title="${t('viewer.toolbar.signals.title')}" aria-label="${t('viewer.toolbar.signals.label')}" aria-expanded="false">
            <span class="codicon codicon-pulse" aria-hidden="true"></span>
            <span id="toolbar-signals-count" class="toolbar-badge" title="${t('viewer.toolbar.signalsCount.title')}"></span>
        </button>
        <button type="button" id="toolbar-deco-btn" class="toolbar-icon-btn" title="${t('viewer.toolbar.deco.title')}" aria-label="${t('viewer.toolbar.deco.label')}">
            <span class="codicon codicon-symbol-color" aria-hidden="true"></span>
        </button>
        <button type="button" id="toolbar-format-btn" class="toolbar-icon-btn" style="display:none" title="${t('viewer.toolbar.format.title')}" aria-label="${t('viewer.toolbar.format.label')}">
            <span class="codicon codicon-open-preview" aria-hidden="true"></span>
        </button>
        <button type="button" id="toolbar-actions-btn" class="toolbar-icon-btn toolbar-actions-trigger" title="${t('viewer.toolbar.actions.title')}" aria-label="${t('viewer.toolbar.actions.label')}" aria-haspopup="true" aria-expanded="false">
            <span class="codicon codicon-kebab-vertical" aria-hidden="true"></span>
        </button>
        <span class="toolbar-sep"></span>
        <span id="level-menu-btn" class="level-summary" role="button" aria-label="${t('viewer.toolbar.levelSummary.label')}" title="${t('viewer.toolbar.levelSummary.title')}">
            ${levelDot('error', 'E')}
            ${levelDot('warning', 'W')}
            ${levelDot('info', 'I')}
            ${levelDot('performance', 'P')}
            ${levelDot('todo', 'T')}
            ${levelDot('notice', 'N')}
            ${levelDot('debug', 'D')}
            ${levelDot('database', 'DB')}
            <span id="level-trigger-label" class="level-trigger-label" title="${t('viewer.toolbar.levelTrigger.title')}">${t('viewer.toolbar.levelAll')}</span>
        </span>
        <span class="toolbar-sep"></span>
        <span id="line-count" aria-live="polite" aria-atomic="true" title="${t('viewer.toolbar.lineCount.title')}"></span>
        <span id="hidden-lines-counter" class="hidden-lines-counter u-hidden" role="button" title="${t('viewer.toolbar.hiddenCounter.title')}" aria-label="${t('viewer.toolbar.hiddenCounter.label')}">
            <span class="codicon codicon-eye-closed"></span>
            <span class="hidden-count-text"></span>
        </span>
        <span id="footer-selection" class="footer-selection" title="${t('viewer.toolbar.selection.title')}"></span>
        <button type="button" id="session-perf-chip" class="session-perf-chip u-hidden" title="${t('viewer.toolbar.perfChip.title')}" aria-label="${t('viewer.toolbar.perfChip.label')}">${t('viewer.toolbar.perfChip.text')}</button>
    </div>
    <div class="toolbar-right">
        <span id="session-details-inline" class="session-details-inline" aria-label="${t('viewer.toolbar.sessionDetails.label')}" title="${t('viewer.toolbar.sessionDetails.title')}"></span>
        <button type="button" id="session-info-btn" class="toolbar-icon-btn session-info-btn" style="display:none" title="${t('viewer.toolbar.sessionInfo.title')}" aria-label="${t('viewer.toolbar.sessionInfo.label')}">
            <span class="codicon codicon-info" aria-hidden="true"></span>
        </button>
        <span id="footer-text" data-version="${ver}" class="toolbar-filename" title="${t('viewer.toolbar.filename.title')}"></span>
    </div>
</div>`;
}
