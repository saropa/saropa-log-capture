/**
 * CSS styles for the severity keywords display in the options panel.
 *
 * Shows configured error/warning/info keywords as colored pill badges
 * grouped by severity level.
 */

export function getSeverityKeywordsStyles(): string {
    return /* css */ `

/* Severity keywords display */
.severity-keywords-display {
    margin-bottom: 8px;
}
.sk-level-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 3px 0;
    font-size: 11px;
}
.sk-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    margin-top: 3px;
}
.sk-label {
    font-weight: 600;
    min-width: 80px;
    color: var(--vscode-foreground);
}
.sk-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
}
.sk-pill {
    background: var(--vscode-badge-background, rgba(90, 93, 94, 0.4));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    white-space: nowrap;
}
.sk-pills em {
    opacity: 0.5;
    font-size: 10px;
}

`;
}
