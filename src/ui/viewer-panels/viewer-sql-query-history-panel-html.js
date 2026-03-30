"use strict";
/**
 * Slide-out SQL query history panel markup (plan DB_11).
 * Behavior script lives in `viewer-sql-query-history-panel-script.ts`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSqlQueryHistoryPanelHtml = getSqlQueryHistoryPanelHtml;
/** Panel HTML in `#panel-slot` (same slide-out pattern as bookmarks). */
function getSqlQueryHistoryPanelHtml() {
    return /* html */ `
<div id="sql-query-history-panel" class="sql-query-history-panel">
    <div class="sql-query-history-header">
        <span>SQL Query History</span>
        <div class="sql-query-history-actions">
            <button type="button" id="sql-query-history-open-viewer" class="sql-query-history-action" title="Open Drift debug viewer in system browser (full window)">
                <span class="codicon codicon-link-external"></span>
            </button>
            <button type="button" id="sql-query-history-copy" class="sql-query-history-action" title="Copy visible rows as JSON">
                <span class="codicon codicon-copy"></span>
            </button>
            <button type="button" id="sql-query-history-close" class="sql-query-history-close" title="Close">
                <span class="codicon codicon-close"></span>
            </button>
        </div>
    </div>
    <div class="sql-query-history-toolbar">
        <input id="sql-query-history-search" type="search" placeholder="Filter by fingerprint or preview\u2026" />
    </div>
    <div id="sql-query-history-drift-status" class="sql-query-history-drift-status u-hidden" role="status" aria-live="polite"></div>
    <div id="sql-query-history-hint" class="sql-query-history-hint u-hidden" role="status" aria-live="polite"></div>
    <div id="sql-query-history-list" class="sql-query-history-list">
        <table class="sql-query-history-table">
            <thead>
                <tr>
                    <th scope="col" class="sql-qh-header sql-qh-header-count" data-sql-qh-sort="count" tabindex="0">
                        Count
                    </th>
                    <th scope="col" class="sql-qh-header sql-qh-header-preview" data-sql-qh-sort="preview" tabindex="0">
                        SQL
                    </th>
                    <th scope="col" class="sql-qh-header sql-qh-header-dur" data-sql-qh-sort="maxDur" tabindex="0" title="Slowest duration in milliseconds">
                        Slow
                    </th>
                </tr>
            </thead>
            <tbody id="sql-query-history-tbody"></tbody>
        </table>
    </div>
    <div id="sql-query-history-empty" class="sql-query-history-empty">No parsed SQL fingerprints in this session yet.</div>
</div>`;
}
//# sourceMappingURL=viewer-sql-query-history-panel-html.js.map