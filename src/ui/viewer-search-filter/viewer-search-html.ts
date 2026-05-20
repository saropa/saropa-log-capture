/**
 * Session-nav compact search — static HTML fragment for the log viewer webview.
 *
 * Injected inside `#session-nav` (see `viewer-content-body.ts`), **not** in `#panel-slot`.
 * Keeps stable element ids consumed by `getSearchScript`, `getSearchTogglesScript`, and
 * `getSearchHistoryScript` (`#search-input`, toggle buttons, `#search-history`, etc.).
 *
 * User-facing strings resolve through t() (host-built HTML). Match-option aria/labels
 * and the mode toggle reuse the search-flyout keys (identical text); only the shorter
 * nav-bar titles get dedicated viewer.searchBar.* keys. See strings-viewer.ts.
 */

import { t } from '../../l10n';

/** HTML for the title-bar search strip (far right) and floating aux panels. */
export function getSessionNavSearchHtml(): string {
    return /* html */ `<div id="session-nav-search-outer" class="session-nav-search-outer">
    <div class="session-search-compact" role="search" aria-label="${t('viewer.search.region')}">
        <div class="session-search-input-shell">
            <input id="search-input" type="text" placeholder="${t('viewer.search.input.placeholder')}" autocomplete="off" />
            <div class="session-search-trailing">
                <div class="session-search-toggles-inline search-input-actions" role="group" aria-label="${t('viewer.search.matchOptions.label')}">
                    <button type="button" id="search-case-toggle" class="search-input-btn" title="${t('viewer.search.case.label')}" aria-label="${t('viewer.search.case.label')}" aria-pressed="false"><span class="codicon codicon-case-sensitive"></span></button>
                    <button type="button" id="search-word-toggle" class="search-input-btn" title="${t('viewer.search.word.label')}" aria-label="${t('viewer.search.word.label')}" aria-pressed="false"><span class="codicon codicon-whole-word"></span></button>
                    <button type="button" id="search-regex-toggle" class="search-input-btn" title="${t('viewer.search.regex.label')}" aria-label="${t('viewer.search.regex.label')}" aria-pressed="false"><span class="codicon codicon-regex"></span></button>
                </div>
                <span id="match-count" class="session-search-match-count"></span>
                <button type="button" id="search-prev" class="session-search-icon-btn" title="${t('viewer.searchBar.prev.title')}" aria-label="${t('viewer.search.prev.label')}">
                    <span class="codicon codicon-chevron-up"></span>
                </button>
                <button type="button" id="search-next" class="session-search-icon-btn" title="${t('viewer.searchBar.next.title')}" aria-label="${t('viewer.search.next.label')}">
                    <span class="codicon codicon-chevron-down"></span>
                </button>
                <button type="button" id="search-funnel-btn" class="session-search-icon-btn session-search-funnel-btn" title="${t('viewer.searchBar.funnel.title')}" aria-expanded="false" aria-haspopup="true" aria-label="${t('viewer.search.funnel.label')}">
                    <span class="codicon codicon-filter"></span>
                </button>
            </div>
        </div>
    </div>
    <div id="search-options-popover" class="search-options-popover" role="dialog" aria-label="${t('viewer.search.modePopover.label')}" hidden>
        <div class="search-options-popover-inner">
            <button type="button" id="search-mode-toggle" class="search-mode-toggle" title="${t('viewer.searchBar.modeToggle.title')}">${t('viewer.search.modeToggle.highlight')}</button>
        </div>
    </div>
    <div id="search-history" class="search-history session-search-history"></div>
</div>`;
}
