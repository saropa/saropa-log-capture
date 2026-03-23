/** DB_06: expanded samples for SQL fingerprint repeat-notification rows. */
export function getSqlRepeatDrilldownStyles(): string {
    return /* css */ `
.sql-repeat-drilldown-toggle {
    display: inline;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-style: italic;
    cursor: pointer;
    text-align: left;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
}
.sql-repeat-drilldown-toggle:hover {
    color: var(--vscode-textLink-foreground);
}
.sql-repeat-drilldown-detail {
    display: block;
    margin-top: 6px;
    margin-bottom: 2px;
    padding: 6px 8px 8px 10px;
    border-left: 2px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.12));
}
.sql-repeat-drilldown-meta {
    font-size: 0.92em;
    margin-bottom: 4px;
    color: var(--vscode-descriptionForeground);
}
.sql-repeat-drilldown-meta-label {
    font-weight: 600;
    margin-right: 4px;
}
.sql-repeat-drilldown-fp {
    font-size: 0.88em;
    word-break: break-all;
}
.sql-repeat-drilldown-snippet {
    margin: 6px 0 8px;
    padding: 6px 8px;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    line-height: 1.35;
    background: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
    border-radius: 3px;
    max-height: 9.5em;
    overflow: auto;
}
.sql-repeat-drilldown-variant-title {
    font-size: 0.88em;
    font-weight: 600;
    margin: 4px 0 2px;
    color: var(--vscode-descriptionForeground);
}
.sql-repeat-drilldown-variant {
    font-size: 0.88em;
    margin: 2px 0;
    padding-left: 4px;
}
.sql-repeat-drilldown-variant-count {
    opacity: 0.85;
    margin-right: 6px;
    font-style: normal;
}
.sql-repeat-drilldown-more {
    font-size: 0.88em;
    font-style: italic;
    margin-top: 4px;
    color: var(--vscode-descriptionForeground);
}
`;
}
