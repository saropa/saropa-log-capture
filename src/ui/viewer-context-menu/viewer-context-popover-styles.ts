/**
 * Context Popover Styles
 *
 * CSS styles for the floating context popover that displays
 * integration data around a clicked log line.
 */

/**
 * Returns the CSS styles for the context popover.
 */
export function getContextPopoverStyles(): string {
    return /* css */ `
/* ===================================================================
   Context Popover
   Floating popover showing integration context for a log line.
   Positioned near the clicked line, dismissible via click outside or Esc.
   =================================================================== */
@keyframes popover-reveal {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.context-popover {
    position: fixed;
    z-index: 1000;
    min-width: 320px;
    max-width: 500px;
    max-height: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-focusBorder));
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    animation: popover-reveal 0.15s ease-out;
}

.popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--vscode-editorHoverWidget-statusBarBackground, rgba(0, 0, 0, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.popover-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.popover-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1;
}
.popover-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

.popover-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.popover-section {
    padding: 0 12px;
    margin-bottom: 8px;
}
.popover-section:last-child {
    margin-bottom: 0;
}

.popover-section-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.popover-icon {
    font-size: 13px;
}

.popover-section-content {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    padding-left: 20px;
}

.popover-item {
    padding: 2px 0;
    line-height: 1.4;
}

.popover-more {
    font-style: italic;
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
    padding-top: 2px;
}

.popover-empty {
    padding: 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}

/* HTTP styles */
.http-item {
    font-family: var(--vscode-editor-font-family, monospace);
}
.http-method {
    font-weight: 600;
    color: var(--vscode-symbolIcon-methodForeground, #b180d7);
}
.http-url {
    color: var(--vscode-textLink-foreground);
}
.http-status.status-ok {
    color: var(--vscode-testing-iconPassed, #73c991);
}
.http-status.status-error {
    color: var(--vscode-errorForeground, #f44);
}
.http-status.status-redirect {
    color: var(--vscode-editorWarning-foreground, #cca700);
}
.http-duration {
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
}

/* Terminal styles */
.terminal-content {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
}
.terminal-line {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Docker styles */
.docker-name {
    font-weight: 500;
}
.docker-status.status-ok {
    color: var(--vscode-testing-iconPassed, #73c991);
}
.docker-status.status-error {
    color: var(--vscode-errorForeground, #f44);
}

.popover-footer {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.popover-btn {
    padding: 4px 10px;
    font-size: 11px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 4px;
    cursor: pointer;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.popover-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.popover-btn.popover-full {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.popover-btn.popover-full:hover {
    background: var(--vscode-button-hoverBackground);
}
`;
}
