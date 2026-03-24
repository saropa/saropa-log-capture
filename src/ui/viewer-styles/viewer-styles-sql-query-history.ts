/**
 * Styles for the SQL query history slide-out (plan DB_11).
 */

export function getSqlQueryHistoryPanelStyles(): string {
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

.sql-query-history-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.sql-query-history-sort-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

#sql-query-history-sort {
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border));
    border-radius: 3px;
    font-size: 11px;
    padding: 2px 6px;
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
    overflow-y: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
}

.sql-query-history-row {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    cursor: pointer;
}

.sql-query-history-row:hover,
.sql-query-history-row:focus {
    outline: none;
    background: var(--vscode-list-hoverBackground);
}

.sql-query-history-row-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
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
    margin-bottom: 4px;
}

.sql-query-history-fp {
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.85;
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
