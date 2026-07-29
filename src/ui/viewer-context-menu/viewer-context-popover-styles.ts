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
    background: var(--vscode-editorHoverWidget-background, var(--surface-1));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-focusBorder));
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    animation: popover-reveal 0.15s ease-out;
}

.popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background: var(--vscode-editorHoverWidget-statusBarBackground, rgba(0, 0, 0, 0.1));
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}

.popover-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
}

.popover-close {
    background: none;
    border: none;
    color: var(--muted);
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
    padding: var(--space-2) 0;
}

.popover-section {
    padding: 0 var(--space-3);
    margin-bottom: var(--space-2);
}
.popover-section:last-child {
    margin-bottom: 0;
}

.popover-section-header {
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text);
    margin-bottom: var(--space-1);
    display: flex;
    align-items: center;
    gap: 6px;
}

.popover-icon {
    font-size: var(--text-body);
}

.popover-section-content {
    font-size: var(--text-caption);
    color: var(--muted);
    padding-left: 20px;
}

.popover-item {
    padding: 2px 0;
    line-height: 1.4;
}

.popover-more {
    font-style: italic;
    color: var(--muted);
    opacity: 0.8;
    padding-top: 2px;
}

.popover-empty {
    padding: var(--space-4);
    text-align: center;
    color: var(--muted);
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
    color: var(--link);
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
    color: var(--muted);
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
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
}

.popover-btn {
    padding: 4px 10px;
    font-size: var(--text-caption);
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

/* Line-local database signal (Drift SQL fingerprint + snippet) */
.popover-meta-label {
    font-weight: 600;
    color: var(--text);
    margin-right: var(--space-1);
}
.popover-fingerprint {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    word-break: break-all;
}
.popover-sql-wrap {
    display: block;
    margin-top: var(--space-1);
}
.popover-sql-snippet {
    display: inline-block;
    max-width: 100%;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: text;
    cursor: text;
    color: var(--vscode-editor-foreground);
}
.popover-db-static-note {
    font-size: var(--text-caption);
    opacity: 0.88;
    margin-top: 6px;
    color: var(--muted);
}
.popover-static-sql-open {
    margin-top: var(--space-1);
}

/* Database queries (from .queries.json sidecar) */
.db-query-item {
    font-family: var(--vscode-editor-font-family, monospace);
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
}
.db-query-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
}
.popover-copy-query {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-caption);
    padding: 0 2px;
    opacity: 0.6;
    flex-shrink: 0;
}
.popover-copy-query:hover {
    opacity: 1;
}

/* Security / audit section */
.popover-security-note {
    font-style: italic;
    opacity: 0.8;
}
`;
}
