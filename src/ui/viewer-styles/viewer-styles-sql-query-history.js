"use strict";
/**
 * Styles for the SQL query history slide-out (plan DB_11).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSqlQueryHistoryPanelStyles = getSqlQueryHistoryPanelStyles;
function getSqlQueryHistoryPanelStyles() {
    return /* css */ `

/* ===================================================================
   SQL Query History Panel
   =================================================================== */
.sql-query-history-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.sql-query-history-panel.visible {
    display: flex;
}

.sql-query-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.sql-query-history-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.sql-query-history-action,
.sql-query-history-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.sql-query-history-action:hover,
.sql-query-history-close:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.sql-query-history-drift-status {
    padding: 6px 12px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.08));
    word-break: break-all;
}

.sql-query-history-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.sql-query-history-toolbar > * {
    margin: 0;
}

#sql-query-history-search {
    flex: 1;
    min-width: 120px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 4px;
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
}

#sql-query-history-search:focus {
    border-color: var(--vscode-focusBorder, #007acc);
}

.sql-query-history-hint {
    padding: 6px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.12));
}

.sql-query-history-list {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
}

.sql-query-history-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

.sql-query-history-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--vscode-editor-background);
}

.sql-qh-header {
    text-align: left;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sql-qh-header:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -2px;
}

/* Order: Count | SQL | Slowest — fixed-width numeric columns; SQL column takes remaining space. */
.sql-qh-header-count,
.sql-qh-cell-count {
    width: 3.5rem;
    padding-left: 6px;
    padding-right: 4px;
    white-space: nowrap;
    text-align: right;
    vertical-align: top;
}

.sql-qh-header-dur,
.sql-qh-cell-dur {
    width: 5rem;
    padding-left: 4px;
    padding-right: 6px;
    white-space: nowrap;
    text-align: right;
    vertical-align: top;
}

.sql-qh-cell-preview {
    vertical-align: top;
    min-width: 0;
}

.sql-qh-header::after {
    content: '';
    margin-left: 4px;
    opacity: 0.6;
}

.sql-qh-header-sorted-asc::after {
    content: '\\25B2';
}

.sql-qh-header-sorted-desc::after {
    content: '\\25BC';
}

#sql-query-history-tbody tr {
    border-bottom: 1px solid var(--vscode-panel-border);
}

#sql-query-history-tbody tr:hover {
    background: var(--vscode-list-hoverBackground);
}

.sql-query-history-row {
    padding: 8px 12px 8px 0;
    cursor: pointer;
}

.sql-query-history-row:focus {
    outline: none;
}

.sql-query-history-count {
    font-weight: 600;
    color: var(--vscode-foreground);
    font-variant-numeric: tabular-nums;
}

.sql-query-history-dur {
    color: var(--vscode-descriptionForeground);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.sql-query-history-preview {
    color: var(--vscode-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: text;
    cursor: text;
}

.sql-query-history-sql {
    margin: 4px 0 8px;
    padding: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--vscode-foreground);
    user-select: text;
    cursor: text;
}

.sql-query-history-row-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
}

.sql-query-history-jump {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    font-size: 11px;
    padding: 0;
}

.sql-query-history-jump:hover { text-decoration: underline; }

.sql-qh-action-btn {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
}

.sql-qh-action-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.sql-query-history-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    white-space: pre-line;
}
`;
}
//# sourceMappingURL=viewer-styles-sql-query-history.js.map