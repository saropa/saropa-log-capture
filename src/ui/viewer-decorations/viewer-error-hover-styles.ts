/**
 * CSS styles for the error hover popup.
 *
 * Floating popup displayed when hovering over error badges.
 * Uses VS Code theme variables for consistent appearance.
 */
export function getErrorHoverStyles(): string {
    return /* css */ `
.error-hover {
    position: fixed;
    z-index: 1001;
    min-width: 280px;
    max-width: 420px;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background));
    color: var(--vscode-editorHoverWidget-foreground, var(--vscode-editor-foreground));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
    font-size: 12px;
    overflow: hidden;
}
.eh-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border));
}
.eh-close {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;
}
.eh-close:hover { color: var(--vscode-editor-foreground); }
.eh-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}
.eh-badge-critical { background: rgba(255, 60, 60, 0.25); color: #ff5555; }
.eh-badge-transient { background: rgba(255, 180, 60, 0.25); color: #ffb43c; }
.eh-badge-bug { background: rgba(255, 100, 160, 0.25); color: #ff64a0; }
.eh-level {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.eh-level-error { background: rgba(255, 60, 60, 0.15); color: #ff5555; }
.eh-level-warning { background: rgba(255, 200, 0, 0.15); color: #ffc800; }
.eh-level-performance { background: rgba(180, 140, 255, 0.15); color: #b48cff; }
.eh-fw { font-size: 10px; color: var(--vscode-descriptionForeground); }
.eh-text {
    padding: 6px 8px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border));
}
.eh-stats {
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.eh-stat {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    display: flex;
    align-items: center;
    gap: 6px;
}
.eh-stat-loading { font-style: italic; }
.eh-stat-new { color: var(--vscode-textLink-foreground); font-weight: 500; }
.eh-hash { font-family: var(--vscode-editor-font-family, monospace); font-size: 10px; opacity: 0.7; }
.eh-crash-cat {
    font-size: 9px;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 2px;
    text-transform: uppercase;
}
.eh-cat-fatal { background: rgba(255, 40, 40, 0.2); color: #ff4040; }
.eh-cat-anr { background: rgba(255, 160, 40, 0.2); color: #ffa028; }
.eh-cat-oom { background: rgba(200, 80, 255, 0.2); color: #c850ff; }
.eh-cat-native { background: rgba(255, 120, 60, 0.2); color: #ff783c; }
.eh-triage {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
}
.eh-triage-open { background: rgba(60, 180, 255, 0.2); color: #3cb4ff; }
.eh-triage-closed { background: rgba(100, 200, 100, 0.2); color: #64c864; }
.eh-triage-muted { background: rgba(160, 160, 160, 0.2); color: #a0a0a0; }
.eh-actions {
    padding: 6px 8px;
    border-top: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border));
    display: flex;
    justify-content: flex-end;
}
.eh-analyze-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 3px 12px;
    font-size: 11px;
    cursor: pointer;
    font-weight: 500;
}
.eh-analyze-btn:hover { background: var(--vscode-button-hoverBackground); }
.eh-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid var(--vscode-descriptionForeground);
    border-top-color: transparent;
    border-radius: 50%;
    animation: eh-spin 0.8s linear infinite;
}
@keyframes eh-spin { to { transform: rotate(360deg); } }
`;
}
