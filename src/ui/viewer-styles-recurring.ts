/**
 * CSS styles for the Recurring Errors slide-out panel.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

/** Return CSS for the recurring errors panel and its cards. */
export function getRecurringPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Recurring Errors Panel — slide-out
   =================================================================== */
.recurring-panel {
    position: fixed;
    left: -100%;
    top: 0;
    bottom: 0;
    width: 30%;
    min-width: 280px;
    max-width: 420px;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    transition: left 0.15s ease;
    z-index: 240;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}

.recurring-panel.visible {
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
}

.recurring-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.recurring-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.recurring-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.recurring-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.recurring-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.recurring-panel-close:hover { color: var(--vscode-errorForeground, #f44); }

.recurring-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

/* --- Recurring error cards --- */
.re-card {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 6px 12px;
    font-size: 12px;
}

.re-card:hover { background: var(--vscode-list-hoverBackground); }
.re-closed { opacity: 0.5; }

.re-text {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-errorForeground);
}

.re-meta { font-size: 0.9em; opacity: 0.8; margin-top: 2px; }

.re-actions { display: flex; gap: 4px; margin-top: 3px; }

.re-action {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 1px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
}

.re-action:hover { background: var(--vscode-button-secondaryHoverBackground); }

.recurring-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.recurring-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: re-pulse 1.5s ease-in-out infinite;
}

@keyframes re-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }

.recurring-footer {
    padding: 8px 12px;
    text-align: center;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
    border-top: 1px solid var(--vscode-panel-border);
}

.recurring-footer:hover { text-decoration: underline; }

/* --- Category badges --- */
.re-cat-badge {
    font-size: 0.7em;
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 700;
    vertical-align: middle;
    margin-right: 4px;
}

.re-cat-fatal { background: #d32f2f; color: #fff; }
.re-cat-anr { background: #f57c00; color: #fff; }
.re-cat-oom { background: #7b1fa2; color: #fff; }
.re-cat-native { background: #757575; color: #fff; }
`;
}
