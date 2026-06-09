/**
 * Slide-out SQL query history panel markup (plan DB_11).
 * Behavior script lives in `viewer-sql-query-history-panel-script.ts`.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer-c.ts.
 */

import { t } from '../../l10n';

/** Panel HTML in `#panel-slot` (same slide-out pattern as bookmarks). */
export function getSqlQueryHistoryPanelHtml(): string {
    return /* html */ `
<div id="sql-query-history-panel" class="sql-query-history-panel">
    <div class="sql-query-history-header">
        <span>${t('viewer.sqlHistory.header')}</span>
        <div class="sql-query-history-actions">
            <button type="button" id="sql-query-history-open-viewer" class="sql-query-history-action" title="${t('viewer.sqlHistory.openViewer.title')}">
                <span class="codicon codicon-link-external"></span>
            </button>
            <button type="button" id="sql-query-history-copy" class="sql-query-history-action" title="${t('viewer.sqlHistory.copy.title')}">
                <span class="codicon codicon-copy"></span>
            </button>
            <button type="button" id="sql-query-history-close" class="sql-query-history-close" title="${t('viewer.sqlHistory.close.title')}">
                <span class="codicon codicon-close"></span>
            </button>
        </div>
    </div>
    <div class="sql-query-history-toolbar">
        <input id="sql-query-history-search" type="search" placeholder="${t('viewer.sqlHistory.search.placeholder')}" />
        <label id="sql-query-history-cumulative-wrap" class="sql-qh-cumulative u-hidden" title="${t('viewer.sqlHistory.currentSessionOnly.title')}">
            <input id="sql-query-history-current-session-only" type="checkbox" />
            <span>${t('viewer.sqlHistory.currentSessionOnly.label')}</span>
        </label>
    </div>
    <div id="sql-query-history-drift-status" class="sql-query-history-drift-status u-hidden" role="status" aria-live="polite"></div>
    <div id="sql-query-history-dashboard" class="sql-qh-dashboard u-hidden">
        <div id="sql-query-history-stats" class="sql-qh-stats"></div>
        <div id="sql-query-history-chart" class="sql-qh-chart"></div>
        <div id="sql-query-history-issues" class="sql-qh-issues u-hidden"></div>
        <div id="sql-query-history-lint" class="sql-qh-lint u-hidden"></div>
    </div>
    <div id="sql-query-history-hint" class="sql-query-history-hint u-hidden" role="status" aria-live="polite"></div>
    <div id="sql-query-history-list" class="sql-query-history-list">
        <table class="sql-query-history-table">
            <thead>
                <tr>
                    <th scope="col" class="sql-qh-header sql-qh-header-count" data-sql-qh-sort="count" tabindex="0">
                        ${t('viewer.sqlHistory.col.count')}
                    </th>
                    <th scope="col" class="sql-qh-header sql-qh-header-preview" data-sql-qh-sort="preview" tabindex="0">
                        ${t('viewer.sqlHistory.col.sql')}
                    </th>
                    <th scope="col" class="sql-qh-header sql-qh-header-dur" data-sql-qh-sort="maxDur" tabindex="0" title="${t('viewer.sqlHistory.col.slow.title')}">
                        ${t('viewer.sqlHistory.col.slow')}
                    </th>
                </tr>
            </thead>
            <tbody id="sql-query-history-tbody"></tbody>
        </table>
    </div>
    <div id="sql-query-history-empty" class="sql-query-history-empty">${t('viewer.sqlHistory.empty')}</div>
</div>`;
}
