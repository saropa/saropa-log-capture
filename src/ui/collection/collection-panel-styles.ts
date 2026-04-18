/** CSS styles for the collection panel webview. */
export function getCollectionPanelStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    padding: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
}
.header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.header-left { display: flex; flex-direction: column; gap: 2px; }
.title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.title-icon { opacity: 0.8; }
.subtitle { font-size: 11px; color: var(--vscode-descriptionForeground); }
.header-right { display: flex; align-items: center; gap: 6px; }
.btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: 3px;
    padding: 4px 10px; cursor: pointer; font-size: 11px;
    display: inline-flex; align-items: center; gap: 4px;
}
.btn:hover { background: var(--vscode-button-hoverBackground); }
.btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.close-btn {
    background: none; border: none; cursor: pointer;
    color: var(--vscode-icon-foreground); font-size: 16px;
    padding: 4px; border-radius: 3px;
}
.close-btn:hover { background: var(--vscode-toolbar-hoverBackground); }

.content {
    flex: 1; overflow-y: auto;
    display: flex; flex-direction: column;
}

.section {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 12px 16px;
}
.section-title {
    font-weight: 600; font-size: 12px; margin-bottom: 8px;
    display: flex; align-items: center; gap: 6px;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
}

.sources-list { display: flex; flex-direction: column; gap: 4px; }
.source-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px; border-radius: 3px; cursor: pointer;
    border: 1px solid transparent;
}
.source-item:hover {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-list-hoverForeground, transparent);
}
.source-icon { opacity: 0.7; flex-shrink: 0; }
.source-label { flex: 1; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.source-type {
    font-size: 10px; padding: 2px 6px; border-radius: 10px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.source-missing {
    color: var(--vscode-errorForeground);
    font-style: italic;
}
.unpin-btn {
    background: none; border: none; cursor: pointer;
    color: var(--vscode-icon-foreground); font-size: 14px;
    padding: 2px 4px; border-radius: 3px; opacity: 0;
}
.source-item:hover .unpin-btn { opacity: 1; }
.unpin-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-errorForeground); }

.empty-sources {
    padding: 16px; text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}

.search-section { padding: 12px 16px; position: relative; }
.search-box {
    display: flex; align-items: center; gap: 8px;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px; padding: 6px 10px;
}
.search-box:focus-within { border-color: var(--vscode-focusBorder); }
.search-icon { opacity: 0.6; flex-shrink: 0; }
.search-input {
    flex: 1; background: none; border: none; outline: none;
    color: var(--vscode-input-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 13px;
}
.search-input::placeholder { color: var(--vscode-input-placeholderForeground); }
.search-history-btn, .search-options-btn, .search-clear {
    background: none; border: none; cursor: pointer;
    color: var(--vscode-icon-foreground); font-size: 14px;
    padding: 2px 4px; border-radius: 3px;
}
.search-history-btn:hover, .search-options-btn:hover, .search-clear:hover {
    background: var(--vscode-toolbar-hoverBackground);
}
.search-history-dropdown {
    position: absolute; top: 100%; left: 16px; right: 16px; z-index: 100;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    max-height: 200px; overflow-y: auto;
}
.history-list { padding: 4px 0; }
.history-item {
    padding: 6px 12px; cursor: pointer;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
}
.history-item:hover { background: var(--vscode-list-hoverBackground); }
.history-clear {
    padding: 6px 12px; cursor: pointer;
    border-top: 1px solid var(--vscode-dropdown-border);
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
}
.history-clear:hover { background: var(--vscode-list-hoverBackground); }
.history-empty {
    padding: 12px; text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
.search-options {
    display: flex; gap: 16px; padding: 8px 0; flex-wrap: wrap;
}
.search-option {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: var(--vscode-descriptionForeground);
    cursor: pointer;
}
.search-option input[type="checkbox"] { cursor: pointer; }
.search-option input[type="number"] {
    width: 50px; padding: 2px 4px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
}
.search-progress {
    display: flex; align-items: center; gap: 8px; padding: 8px 0;
}
.progress-bar {
    flex: 1; height: 4px; background: var(--vscode-editorWidget-background);
    border-radius: 2px; overflow: hidden;
}
.progress-fill {
    height: 100%; background: var(--vscode-progressBar-background);
    width: 0%; transition: width 0.15s ease-out;
}
.progress-text { font-size: 11px; color: var(--vscode-descriptionForeground); }
.hidden { display: none !important; }

.results-section {
    flex: 1; padding: 0 16px 16px;
    overflow-y: auto;
}
.results-header {
    font-size: 11px; color: var(--vscode-descriptionForeground);
    margin-bottom: 8px; padding-top: 8px;
}
.search-time { opacity: 0.7; }
.search-cancelled {
    padding: 16px; text-align: center;
    color: var(--vscode-editorWarning-foreground);
    font-style: italic;
}
.result-group { margin-bottom: 12px; }
.result-group-header {
    font-size: 11px; font-weight: 600;
    padding: 4px 0; display: flex; align-items: center; gap: 6px;
}
.result-group-name { flex-shrink: 0; }
.result-group-count { color: var(--vscode-descriptionForeground); }
.result-group-sidecar {
    font-size: 9px; padding: 1px 4px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 3px; text-transform: uppercase;
}
.result-group-warning { margin-left: 4px; cursor: help; }
.result-context {
    padding: 2px 8px 2px 20px;
    cursor: pointer; border-radius: 3px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    opacity: 0.5;
}
.result-context:hover { background: var(--vscode-list-hoverBackground); opacity: 0.7; }
.result-context .context-line { font-style: italic; }
.result-item {
    padding: 4px 8px 4px 20px;
    cursor: pointer; border-radius: 3px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.result-item:hover { background: var(--vscode-list-hoverBackground); }
.result-line {
    color: var(--vscode-descriptionForeground);
    margin-right: 8px;
}
.result-match { background: var(--vscode-editor-findMatchHighlightBackground); }
.result-truncated {
    padding: 4px 20px;
    font-size: 11px; font-style: italic;
    color: var(--vscode-descriptionForeground);
}
.source-warning { margin-right: 4px; }

.notes-section { padding: 12px 16px; }
.notes-textarea {
    width: 100%; min-height: 80px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px; padding: 8px;
    font-family: var(--vscode-font-family, sans-serif);
    font-size: 12px; resize: vertical;
}
.notes-textarea:focus { border-color: var(--vscode-focusBorder); outline: none; }

.actions-bar {
    display: flex; gap: 8px; padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
    flex-shrink: 0;
}

.loading {
    display: flex; align-items: center; justify-content: center;
    padding: 32px; color: var(--vscode-descriptionForeground);
}
.spinner {
    width: 16px; height: 16px; border: 2px solid var(--vscode-descriptionForeground);
    border-top-color: transparent; border-radius: 50%;
    animation: spin 0.8s linear infinite; margin-right: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.no-collection {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100%; padding: 32px;
    text-align: center; color: var(--vscode-descriptionForeground);
}
.no-collection-icon { font-size: 48px; opacity: 0.3; margin-bottom: 16px; }
.no-collection-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--vscode-foreground); }
.no-collection-text { font-size: 13px; margin-bottom: 16px; max-width: 280px; }
`;
}
