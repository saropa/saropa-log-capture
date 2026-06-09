/**
 * Styles for the SQL query history dashboard strip (plan **DB_18 Phase 2**): stat cards + bar chart.
 * Separate module so `viewer-styles-sql-query-history.ts` stays under the file-length limit.
 */

export function getSqlQueryHistoryDashboardStyles(): string {
    return /* css */ `

/* ===================================================================
   SQL Query History Dashboard (stat cards + top-queries bar chart)
   =================================================================== */
.sql-qh-dashboard {
    padding: 6px 12px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.sql-qh-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

/* Each card is a flexible equal-share column so 2-4 cards fill the strip without horizontal scroll. */
.sql-qh-stat {
    flex: 1 1 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 6px;
    border-radius: 4px;
    background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.1));
}

.sql-qh-stat-val {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--vscode-foreground);
}

.sql-qh-stat-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.sql-qh-chart {
    margin-top: 8px;
}

.sql-qh-chart-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* label | bar track | count — the track flexes so bars share a common right-aligned scale. */
.sql-qh-chart-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
}

.sql-qh-chart-label {
    flex: 0 0 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-foreground);
}

.sql-qh-chart-track {
    flex: 1 1 auto;
    height: 10px;
    background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.12));
    border-radius: 2px;
    overflow: hidden;
}

.sql-qh-chart-bar {
    display: block;
    height: 100%;
    background: var(--vscode-charts-blue, var(--vscode-progressBar-background));
    border-radius: 2px;
}

.sql-qh-chart-num {
    flex: 0 0 auto;
    min-width: 32px;
    text-align: right;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--vscode-descriptionForeground);
}

/* --- Drift Advisor issues sub-section (index suggestions + anomalies) --- */
.sql-qh-issues {
    margin-top: 8px;
}

.sql-qh-issues-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* A colored left border carries severity at a glance; warning vs info reuse VS Code theme tokens. */
.sql-qh-issue {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    margin-bottom: 2px;
    border-left: 2px solid var(--vscode-charts-blue);
    font-size: 11px;
}

.sql-qh-issue-warning {
    border-left-color: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow));
}

.sql-qh-issue-info {
    border-left-color: var(--vscode-charts-blue, var(--vscode-editorInfo-foreground));
}

.sql-qh-issue-loc {
    flex: 0 0 auto;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-foreground);
    font-weight: 600;
}

.sql-qh-issue-msg {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
}

.sql-qh-issue-fix {
    flex: 0 0 auto;
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    padding: 0 2px;
}

.sql-qh-issue-fix:hover {
    color: var(--vscode-textLink-activeForeground);
}

/* --- Saropa Lints static-code section (Drift-rule violations + enable-pack advice) --- */
.sql-qh-lint {
    margin-top: 8px;
}

.sql-qh-lint-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* The advice is a call-to-action, so it gets the prominent notification treatment rather than a row. */
.sql-qh-lint-advice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    background: var(--vscode-inputValidation-infoBackground, var(--vscode-editorWidget-background));
    border: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-panel-border));
}

.sql-qh-lint-advice-msg {
    flex: 1 1 auto;
    font-size: 11px;
    color: var(--vscode-foreground);
}

.sql-qh-lint-enable {
    flex: 0 0 auto;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
}

.sql-qh-lint-enable:hover {
    background: var(--vscode-button-hoverBackground, var(--vscode-button-background));
}
`;
}
