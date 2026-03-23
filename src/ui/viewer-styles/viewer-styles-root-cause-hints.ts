/** DB_14: collapsible hypotheses strip above the log scroller. */
export function getRootCauseHypothesesStyles(): string {
    return /* css */ `
.root-cause-hypotheses {
    flex-shrink: 0;
    margin: 0 0 4px 0;
    padding: 6px 10px 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    font-size: 12px;
    line-height: 1.35;
    max-height: 42vh;
    overflow: auto;
}
.root-cause-hypotheses-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
}
.root-cause-hypotheses-title {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
}
.root-cause-hypotheses-dismiss {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 2px;
}
.root-cause-hypotheses-dismiss:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.root-cause-hypotheses-disclaimer {
    margin: 0 0 6px 0;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
.root-cause-hypotheses-list {
    margin: 0;
    padding-left: 1.15em;
}
.root-cause-hypotheses-list li {
    margin: 4px 0;
}
.root-cause-hyp-evidence {
    margin-left: 6px;
    font-size: 11px;
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    text-decoration: underline;
    white-space: nowrap;
}
.root-cause-hyp-evidence:hover {
    opacity: 0.85;
}
.root-cause-hyp-conf {
    font-size: 10px;
    margin-left: 6px;
    opacity: 0.85;
    text-transform: uppercase;
}
`;
}
