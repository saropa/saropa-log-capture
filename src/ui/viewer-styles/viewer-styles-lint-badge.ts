/**
 * CSS styles for lint diagnostic badges on log lines.
 * Badges show error/warning counts using VS Code theme colours.
 */

/** Returns the CSS for lint diagnostic badge styling. */
export function getLintBadgeStyles(): string {
    return /* css */ `
.lint-badge {
    display: inline-block;
    padding: 0 4px;
    margin-right: 3px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    vertical-align: middle;
    cursor: default;
    line-height: 1.4;
}
.lint-badge-error {
    background: rgba(255, 0, 0, 0.12);
    color: var(--vscode-errorForeground, #f48771);
    border: 1px solid rgba(255, 0, 0, 0.25);
}
.lint-badge-warning {
    background: rgba(255, 165, 0, 0.12);
    color: var(--vscode-debugConsole-warningForeground, #cca700);
    border: 1px solid rgba(255, 165, 0, 0.25);
}
`;
}
