/**
 * Search flyout HTML — floating overlay anchored top-right of the log area.
 *
 * Toggled via the view title bar `$(search)` icon or the webview toolbar search button.
 * Contains the search input with clear [x] button, case/word/regex toggles,
 * match navigation, highlight/filter mode popover, and search history.
 *
 * Preserved IDs: `#search-input`, `#search-clear-btn`, `#search-case-toggle`,
 * `#search-word-toggle`, `#search-regex-toggle`, `#match-count`, `#search-prev`,
 * `#search-next`, `#search-funnel-btn`, `#search-mode-toggle`,
 * `#search-options-popover`, `#search-history`.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer.ts.
 */

import { t } from '../../l10n';

/** Search flyout HTML fragment — inserted after the toolbar element. */
export function getSearchFlyoutHtml(): string {
    return /* html */ `
<div id="search-flyout" class="search-flyout u-hidden" role="search" aria-label="${t('viewer.search.region')}">
    <div class="search-flyout-row">
        <div class="session-search-input-shell">
            <input id="search-input" type="text" placeholder="${t('viewer.search.input.placeholder')}" title="${t('viewer.search.input.title')}" autocomplete="off" />
            <button type="button" id="search-clear-btn" class="session-search-icon-btn search-clear-btn" title="${t('viewer.search.clear.title')}" aria-label="${t('viewer.search.clear.label')}" style="display:none">
                <span class="codicon codicon-close"></span>
            </button>
            <div class="session-search-trailing">
                <div class="session-search-toggles-inline search-input-actions" role="group" aria-label="${t('viewer.search.matchOptions.label')}">
                    <button type="button" id="search-case-toggle" class="search-input-btn" title="${t('viewer.search.case.title')}" aria-label="${t('viewer.search.case.label')}" aria-pressed="false"><span class="codicon codicon-case-sensitive"></span></button>
                    <button type="button" id="search-word-toggle" class="search-input-btn" title="${t('viewer.search.word.title')}" aria-label="${t('viewer.search.word.label')}" aria-pressed="false"><span class="codicon codicon-whole-word"></span></button>
                    <button type="button" id="search-regex-toggle" class="search-input-btn" title="${t('viewer.search.regex.title')}" aria-label="${t('viewer.search.regex.label')}" aria-pressed="false"><span class="codicon codicon-regex"></span></button>
                </div>
                <span id="match-count" class="session-search-match-count" title="${t('viewer.search.matchCount.title')}"></span>
                <button type="button" id="search-prev" class="session-search-icon-btn" title="${t('viewer.search.prev.title')}" aria-label="${t('viewer.search.prev.label')}">
                    <span class="codicon codicon-chevron-up"></span>
                </button>
                <button type="button" id="search-next" class="session-search-icon-btn" title="${t('viewer.search.next.title')}" aria-label="${t('viewer.search.next.label')}">
                    <span class="codicon codicon-chevron-down"></span>
                </button>
                <button type="button" id="search-funnel-btn" class="session-search-icon-btn session-search-funnel-btn" title="${t('viewer.search.funnel.title')}" aria-expanded="false" aria-haspopup="true" aria-label="${t('viewer.search.funnel.label')}">
                    <span class="codicon codicon-filter"></span>
                </button>
            </div>
        </div>
    </div>
    <div id="search-options-popover" class="search-flyout-options" role="dialog" aria-label="${t('viewer.search.modePopover.label')}" hidden>
        <div class="search-options-popover-inner">
            <button type="button" id="search-mode-toggle" class="search-mode-toggle" title="${t('viewer.search.modeToggle.title')}">${t('viewer.search.modeToggle.highlight')}</button>
        </div>
    </div>
    <div id="search-history" class="search-history search-flyout-history"></div>
</div>`;
}
