/** Styles for synthetic N+1 / DB burst signal rows in the log viewer. */
export function getNPlusOneSignalStyles(): string {
    return /* css */ `
/* Drift SQL N+1 heuristic signal row (see modules/db/drift-n-plus-one-detector.ts) */
.n1-signal {
    color: var(--vscode-editorWarning-foreground, var(--accent-warning));
    font-style: normal;
}
.n1-conf {
    font-size: 10px;
    border: 1px solid currentColor;
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    margin: 0 var(--space-1);
}
.n1-conf-high { color: var(--vscode-errorForeground, var(--accent-critical)); }
.n1-conf-medium { color: var(--vscode-editorWarning-foreground, var(--accent-warning)); }
.n1-conf-low { color: var(--vscode-descriptionForeground, var(--muted)); }
.n1-fp {
    opacity: 0.85;
    color: var(--vscode-descriptionForeground);
}
.n1-actions {
    margin-left: var(--space-2);
}
.n1-action {
    color: var(--vscode-textLink-foreground, var(--link));
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
}
.n1-action:hover {
    text-decoration-style: solid;
}
`;
}
