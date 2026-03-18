/**
 * CSS styles for the Insight slide-out panel (Cases, Recurring, Performance).
 * Reuses session-investigation and recurring card classes from other panel styles.
 */

/** Return CSS for the Insight panel, tabs, and panes. */
export function getInsightPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Insight Panel — slide-out (unified Cases, Recurring, Performance)
   =================================================================== */
.insight-panel {
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

.insight-panel.visible {
    display: flex;
}

.insight-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.insight-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 3px;
}

.insight-panel-close:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.insight-tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 0 8px;
    gap: 4px;
}

.insight-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 8px 12px;
    margin-bottom: -1px;
    transition: color 0.12s ease, border-bottom-color 0.12s ease;
}

.insight-tab:hover {
    color: var(--vscode-foreground);
}

.insight-tab.active {
    color: var(--vscode-foreground);
    border-bottom-color: var(--vscode-focusBorder, #007acc);
}

.insight-panel-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    position: relative;
}

.insight-pane {
    display: none;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: 8px;
}

.insight-pane.active {
    display: flex;
}

.insight-pane {
    transition: opacity 0.15s ease;
}

.insight-pane .session-investigations {
    flex: 0 0 auto;
}

.insight-recurring-inner {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.insight-recurring-footer {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.insight-recurring-footer .recurring-footer-action {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
}

.insight-recurring-footer .recurring-footer-action:hover {
    text-decoration: underline;
}

/* Embedded performance panel inside Insight: no slide-out chrome, just content */
.insight-performance-pane .performance-panel {
    display: flex !important;
    min-width: 0;
    border: none;
    box-shadow: none;
    background: transparent;
}

.insight-performance-pane .performance-panel-header {
    padding: 4px 0 8px;
}

.insight-performance-pane .pp-close {
    display: none;
}
`;
}
