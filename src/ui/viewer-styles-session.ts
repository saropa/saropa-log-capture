/**
 * CSS styles for the session history slide-out panel.
 *
 * Follows the same fixed-position slide-in pattern as the search
 * and options panels, sitting to the left of the icon bar.
 */

/** Return CSS for the session panel and its list items. */
export function getSessionPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Session Panel — slide-out (same pattern as search/options)
   =================================================================== */
.session-panel {
    min-width: 560px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.session-panel-resize {
    position: absolute; right: -3px; top: 0; bottom: 0; width: 6px;
    cursor: col-resize; z-index: 1;
}
.session-panel-resize:hover,
.session-panel-resize.dragging {
    background: var(--vscode-focusBorder);
    opacity: 0.5;
}

.session-panel.visible {
    display: flex;
}

.session-panel-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-panel-title {
    flex-shrink: 0;
}

.session-header-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-weight: 500;
}

.session-header-path:hover {
    color: var(--vscode-textLink-foreground);
    text-decoration: underline;
}

/* Separator dot excluded from selection when user selects the path. */
.session-path-sep {
    user-select: none;
}

.session-panel-actions {
    display: flex;
    gap: 4px;
    align-items: center;
}

.session-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.session-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.session-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.session-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

/* --- Session panel display toggles --- */
.session-panel-toggles {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-toggle-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.session-toggle-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.session-sort-btn { margin-left: auto; }

.session-toggle-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-focusBorder);
}

.session-panel-content {
    flex: 1;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
}

/* --- Session list items --- */
.session-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.session-item-active .session-item-icon .codicon {
    color: var(--vscode-charts-red, #f44336);
}

.session-item-icon {
    user-select: none;
}
.session-item-icon .codicon {
    font-size: 14px;
    margin-top: 2px;
}

.session-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.session-item-name {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.session-item-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Latest suffix --- */
.session-latest { opacity: 0.5; font-style: italic; font-size: 11px; margin-left: 3px; }

/* --- Day headings --- */
.session-day-heading {
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    position: sticky;
    top: 0;
    z-index: 1;
}

/* --- Session context menu --- */
.session-context-menu {
    display: none; position: fixed; z-index: 300;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    padding: 4px 0; min-width: 180px; overflow-y: auto;
}
.session-context-menu.visible { display: block; }

/* --- Severity dots --- */
.sev-dots { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--vscode-descriptionForeground); }
.sev-pair { display: inline-flex; align-items: center; gap: 2px; }
.sev-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.sev-error { background: var(--vscode-charts-red, #f44336); }
.sev-warning { background: var(--vscode-charts-yellow, #ffc107); }
.sev-perf { background: var(--vscode-charts-purple, #a855f7); }
.sev-fw { background: var(--vscode-charts-blue, #2196f3); }
.sev-info { background: var(--vscode-charts-green, #4caf50); }

/* --- Session tag chips (correlation filters: file/error tags across sessions) --- */
.session-tags-section {
    padding: 6px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
    min-height: 0;
}
.session-tags-section .session-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    max-height: 4.8em;
    overflow-y: auto;
    overflow-x: hidden;
}
.session-tags-section .source-tag-chip {
    border: none;
    background: var(--vscode-badge-background, rgba(128, 128, 128, 0.25));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
}
.session-tags-section .source-tag-chip.active {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
}
.session-tags-section .source-tag-chip .tag-label {
    display: inline-block;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.session-tags-section .tag-count {
    flex-shrink: 0;
}

/* --- Empty / loading states --- */
.session-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.session-loading {
    padding: 12px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.session-loading-bar {
    height: 4px;
    background: var(--vscode-progressBar-background, rgba(128, 128, 128, 0.2));
    border-radius: 2px;
    overflow: hidden;
}

.session-loading-bar-fill {
    height: 100%;
    width: 40%;
    background: var(--vscode-progressBar-foreground, var(--vscode-focusBorder, #3794ff));
    border-radius: 2px;
    animation: session-progress-indeterminate 1.2s ease-in-out infinite;
}

.session-loading-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

.session-loading-shimmer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
}

.session-shimmer-line {
    height: 36px;
    border-radius: 4px;
    background: var(--vscode-sideBar-background, #252526);
    position: relative;
    overflow: hidden;
}

.session-shimmer-line::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 45%,
        var(--vscode-focusBorder, rgba(255, 255, 255, 0.12)) 50%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 55%,
        transparent 100%
    );
    background-size: 200% 100%;
    animation: session-shimmer 1.8s ease-in-out infinite;
}

.session-shimmer-line-short {
    width: 60%;
}

@keyframes session-progress-indeterminate {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(150%); }
    100% { transform: translateX(-100%); }
}

@keyframes session-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;
}
