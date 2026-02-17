/**
 * CSS styles for the Crashlytics slide-out panel.
 * Includes setup wizard, issue cards, and diagnostic box styles.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

/** Return CSS for the crashlytics panel and all its sub-components. */
export function getCrashlyticsPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Crashlytics Panel — slide-out
   =================================================================== */
.crashlytics-panel {
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

.crashlytics-panel.visible {
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
}

.crashlytics-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.crashlytics-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.crashlytics-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.crashlytics-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.crashlytics-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.crashlytics-panel-close:hover { color: var(--vscode-errorForeground, #f44); }

.crashlytics-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

/* --- Issue cards --- */
.cp-item {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
}

.cp-item:hover { background: var(--vscode-list-hoverBackground); }
.cp-title { font-weight: 600; margin-bottom: 2px; }
.cp-meta { font-size: 0.9em; opacity: 0.8; }

.cp-badge {
    font-size: 0.7em;
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 700;
    vertical-align: middle;
}

.cp-badge-fatal { background: #d32f2f; color: #fff; }
.cp-badge-nonfatal { background: #f9a825; color: #000; }
.cp-badge-regression, .cp-badge-regressed { background: #d32f2f; color: #fff; }
.cp-badge-closed { background: #388e3c; color: #fff; }
.cp-badge-open { background: #757575; color: #fff; }

.cp-actions { display: flex; gap: 4px; margin-top: 4px; }

.cp-action-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
}

.cp-action-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.cp-console {
    padding: 8px 12px;
    text-align: center;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
}

.cp-console:hover { text-decoration: underline; }

.cp-empty { padding: 16px 12px; opacity: 0.7; font-style: italic; text-align: center; font-size: 12px; }
.cp-error { color: var(--vscode-errorForeground); font-size: 0.9em; padding: 6px 12px; }

/* --- Crash detail (loaded into issue card) --- */
.cp-detail { overflow: hidden; max-height: 0; transition: max-height 0.3s ease; }
.cp-detail.expanded { max-height: 2000px; padding: 4px 0; border-top: 1px solid var(--vscode-panel-border); }
.cp-detail-loading {
    padding: 6px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    animation: cp-pulse 1.5s ease-in-out infinite;
}

@keyframes cp-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }

.cp-expand-icon { float: right; font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.2s; }
.cp-item.detail-open .cp-expand-icon { transform: rotate(90deg); }

/* --- Loading state --- */
.crashlytics-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: cp-pulse 1.5s ease-in-out infinite;
}

/* --- Refresh note --- */
.cp-refresh-note { font-weight: normal; font-size: 0.85em; opacity: 0.6; margin-left: 4px; }

` + getSetupStyles() + getDiagnosticStyles();
}

function getSetupStyles(): string {
    return /* css */ `

/* --- Setup wizard --- */
.cp-setup-header { font-size: 0.85em; opacity: 0.6; margin: 8px 12px; }
.cp-setup-title { font-weight: 600; font-size: 1.1em; margin: 0 12px 4px; }
.cp-setup-step { margin: 8px 12px; }
.cp-setup-step p { margin: 4px 0 8px; opacity: 0.85; line-height: 1.4; font-size: 12px; }
.cp-setup-step code {
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 4px;
    border-radius: 2px;
    font-family: var(--vscode-editor-font-family);
}

.cp-setup-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 13px;
    display: block;
    margin: 8px 0;
}

.cp-setup-btn:hover { background: var(--vscode-button-hoverBackground); }

.cp-setup-link {
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    text-decoration: underline;
    display: inline-block;
    margin: 4px 0;
}

.cp-setup-settings {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    opacity: 0.8;
}

.cp-setup-tip {
    margin: 16px 12px 8px;
    font-size: 0.9em;
    opacity: 0.6;
    font-style: italic;
}

.cp-check-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    margin: 8px 12px;
}

.cp-check-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
`;
}

function getDiagnosticStyles(): string {
    return /* css */ `

/* --- Diagnostic box --- */
.cp-diag-box {
    margin: 10px 12px;
    padding: 8px;
    background: var(--vscode-inputValidation-warningBackground);
    border-left: 3px solid var(--vscode-inputValidation-warningBorder);
    border-radius: 3px;
    font-size: 0.9em;
}

.cp-diag-msg { margin-bottom: 4px; }
.cp-diag-status { font-size: 0.85em; opacity: 0.8; margin-top: 2px; }
.cp-diag-tech { margin-top: 6px; font-size: 0.85em; }
.cp-diag-tech summary { cursor: pointer; opacity: 0.8; }
.cp-diag-tech pre {
    margin: 4px 0;
    padding: 4px;
    background: var(--vscode-textCodeBlock-background);
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family);
    font-size: 0.9em;
    white-space: pre-wrap;
    word-break: break-all;
}

.cp-diag-time { font-size: 0.8em; margin-top: 6px; opacity: 0.6; font-style: italic; }
`;
}
