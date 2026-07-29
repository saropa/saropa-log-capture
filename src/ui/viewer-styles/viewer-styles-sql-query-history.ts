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
    background: var(--vscode-sideBar-background, var(--surface-1));
    border-right: 1px solid var(--vscode-sideBar-border, var(--border));
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
    padding: var(--space-2) var(--space-3);
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--border);
}

.sql-query-history-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.sql-query-history-action,
.sql-query-history-close {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    font-size: 14px;
}

.sql-query-history-action:hover,
.sql-query-history-close:hover {
    color: var(--text);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* The × is a dismiss control, so it takes the shared red-accent close treatment; the action
   buttons keep the neutral foreground-on-hover from the rule above. */
.sql-query-history-close:hover { color: var(--vscode-errorForeground, #f44); }

.sql-query-history-drift-status {
    padding: 6px 12px;
    font-size: var(--text-caption);
    line-height: 1.35;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.08));
    /* anywhere (not break-all): lets the long server URL wrap when it must, WITHOUT chopping
       ordinary words mid-character — break-all split "reachable" into "reac"/"hable" at narrow widths. */
    overflow-wrap: anywhere;
}

.sql-query-history-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
}
.sql-query-history-toolbar > * {
    margin: 0;
}

#sql-query-history-search {
    flex: 1;
    min-width: 120px;
    background: var(--inset);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--border));
    border-radius: 4px;
    font-size: 12px;
    padding: var(--space-1) var(--space-2);
    outline: none;
}

#sql-query-history-search:focus {
    border-color: var(--vscode-focusBorder, #007acc);
}

.sql-query-history-hint {
    padding: 6px 12px;
    font-size: var(--text-caption);
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.12));
}

.sql-query-history-list {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--text-caption);
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
    background: var(--surface-1);
}

.sql-qh-header {
    text-align: left;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
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

/* No captured queries: headers are inert. Dim them and drop the pointer cursor so they don't
   look clickable; the JS handler also returns early on aria-disabled. */
.sql-qh-header-disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
}

/* Order: Count | SQL | Slow — fixed-width numeric columns; SQL column takes remaining space. */
.sql-qh-header-count,
.sql-qh-cell-count {
    width: 3.5rem;
    padding-left: 6px;
    padding-right: var(--space-1);
    white-space: nowrap;
    text-align: right;
    vertical-align: top;
}

.sql-qh-header-dur,
.sql-qh-cell-dur {
    width: 5rem;
    padding-left: var(--space-1);
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
    margin-left: var(--space-1);
    opacity: 0.6;
}

.sql-qh-header-sorted-asc::after {
    content: '\\25B2';
}

.sql-qh-header-sorted-desc::after {
    content: '\\25BC';
}

#sql-query-history-tbody tr {
    border-bottom: 1px solid var(--border);
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

/* Transient highlight when a deep-link (saropaLogCapture.openSqlHistoryForFingerprint)
   scrolls to a query, so the user sees which row the jump landed on. Removed by script after ~2s. */
.sql-qh-focus-flash {
    background: var(--vscode-list-hoverBackground);
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}

.sql-query-history-count {
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
}

.sql-query-history-dur {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.sql-query-history-preview {
    color: var(--text);
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
    color: var(--text);
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
    font-size: var(--text-caption);
    padding: 0;
}

.sql-query-history-jump:hover { text-decoration: underline; }

.sql-qh-action-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    font-size: 12px;
}

.sql-qh-action-btn:hover {
    color: var(--text);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.sql-query-history-empty {
    padding: var(--space-4) var(--space-3);
    font-size: 12px;
    color: var(--muted);
    text-align: center;
    white-space: pre-line;
}

/* DB_18: "Current session only" filter, lives in the toolbar next to the search input.
   Class name kept (.sql-qh-cumulative) so existing layout/spacing rules apply unchanged. */
.sql-qh-cumulative {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-caption);
    color: var(--muted);
    cursor: pointer;
    user-select: none;
}

.sql-qh-cumulative input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
}

.sql-qh-cumulative:hover {
    color: var(--text);
}

/* DB_18b 1c: pager row shown only when the scale-gated window hides rows (>2000 filtered). */
.sql-qh-pager-cell {
    padding: 10px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
}

.sql-qh-pager-note { margin-right: var(--space-2); }

.sql-qh-show-more {
    background: none;
    border: 1px solid var(--vscode-button-border, var(--vscode-contrastBorder, transparent));
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: var(--radius-sm);
}

.sql-qh-show-more:hover {
    color: var(--text);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
`;
}
