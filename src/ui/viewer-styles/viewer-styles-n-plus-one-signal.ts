/** Styles for synthetic N+1 / DB burst signal rows in the log viewer. */
export function getNPlusOneSignalStyles(): string {
    return /* css */ `
/* Drift SQL N+1 heuristic signal row (see modules/db/drift-n-plus-one-detector.ts) */
.n1-signal {
    color: var(--vscode-editorWarning-foreground, #ffcc00);
    font-style: normal;
}
.n1-conf {
    font-size: 10px;
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0 4px;
    margin: 0 4px;
}
.n1-conf-high { color: var(--vscode-errorForeground, #f48771); }
.n1-conf-medium { color: var(--vscode-editorWarning-foreground, #ffcc00); }
.n1-conf-low { color: var(--vscode-descriptionForeground, #9da3a6); }
.n1-fp {
    opacity: 0.85;
    color: var(--vscode-descriptionForeground);
}
.n1-actions {
    margin-left: 8px;
}
.n1-action {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
}
.n1-action:hover {
    text-decoration-style: solid;
}
`;
}
