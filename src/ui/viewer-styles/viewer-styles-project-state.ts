/**
 * CSS for the "Project state" slide-out panel (plan 055 Stage 3). Container follows the same
 * fixed-position icon-bar pattern as the About panel; the "may already be fixed" / changelog-since
 * rows reuse the crashlytics `.cd-*` classes so the signal looks identical to the crash detail.
 */

/** Return CSS for the project-state panel and its rows. */
export function getProjectStatePanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Project state panel — slide-out (same pattern as the About panel)
   =================================================================== */
.project-state-panel {
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

.project-state-panel.visible {
    display: flex;
}

.project-state-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.project-state-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.project-state-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.project-state-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
}

.ps-section {
    margin-bottom: 12px;
}

.ps-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 2px 0;
}

.ps-label {
    flex: none;
    min-width: 110px;
    color: var(--vscode-descriptionForeground);
}

.ps-value {
    flex: 1;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, monospace);
}

.ps-commit-subject {
    padding: 0 0 2px 118px;
    color: var(--vscode-foreground);
}

.ps-clean { color: var(--vscode-testing-iconPassed, #2ea043); }
.ps-dirty { color: var(--vscode-editorWarning-foreground, #cca700); }

.ps-note,
.ps-empty {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
`;
}
