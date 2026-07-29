/** CSS styles for the collection panel webview. */
export function getCollectionPanelStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--surface-1);
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
    padding: var(--space-3) var(--space-4);
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}
.header-left { display: flex; flex-direction: column; gap: 2px; }
.title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.title-icon { opacity: 0.8; }
.subtitle { font-size: var(--text-caption); color: var(--muted); }
.header-right { display: flex; align-items: center; gap: 6px; }
.btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: var(--radius-sm);
    padding: 4px 10px; cursor: pointer; font-size: var(--text-caption);
    display: inline-flex; align-items: center; gap: var(--space-1);
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
    padding: var(--space-1); border-radius: var(--radius-sm);
}
.close-btn:hover { background: var(--vscode-toolbar-hoverBackground); }

.content {
    flex: 1; overflow-y: auto;
    display: flex; flex-direction: column;
}

.section {
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) var(--space-4);
}
.section-title {
    font-weight: 600; font-size: 12px; margin-bottom: var(--space-2);
    display: flex; align-items: center; gap: 6px;
    text-transform: uppercase;
    color: var(--muted);
}

.sources-list { display: flex; flex-direction: column; gap: var(--space-1); }
.source-item {
    display: flex; align-items: center; gap: var(--space-2);
    padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer;
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
    padding: 2px 4px; border-radius: var(--radius-sm); opacity: 0;
}
.source-item:hover .unpin-btn { opacity: 1; }
.unpin-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-errorForeground); }

.empty-sources {
    padding: var(--space-4); text-align: center;
    color: var(--muted);
    font-style: italic;
}

.search-section { padding: var(--space-3) var(--space-4); position: relative; }
.search-box {
    display: flex; align-items: center; gap: var(--space-2);
    background: var(--inset);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px; padding: 6px 10px;
}
.search-box:focus-within { border-color: var(--vscode-focusBorder); }
.search-icon { opacity: 0.6; flex-shrink: 0; }
.search-input {
    flex: 1; background: none; border: none; outline: none;
    color: var(--vscode-input-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--text-body);
}
.search-input::placeholder { color: var(--vscode-input-placeholderForeground); }
.search-history-btn, .search-options-btn, .search-clear {
    background: none; border: none; cursor: pointer;
    color: var(--vscode-icon-foreground); font-size: 14px;
    padding: 2px 4px; border-radius: var(--radius-sm);
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
.history-list { padding: var(--space-1) 0; }
.history-item {
    padding: 6px 12px; cursor: pointer;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
}
.history-item:hover { background: var(--vscode-list-hoverBackground); }
.history-clear {
    padding: 6px 12px; cursor: pointer;
    border-top: 1px solid var(--vscode-dropdown-border);
    color: var(--muted);
    font-size: var(--text-caption);
}
.history-clear:hover { background: var(--vscode-list-hoverBackground); }
.history-empty {
    padding: var(--space-3); text-align: center;
    color: var(--muted);
    font-style: italic;
}
.search-options {
    display: flex; gap: var(--space-4); padding: var(--space-2) 0; flex-wrap: wrap;
}
.search-option {
    display: flex; align-items: center; gap: 6px;
    font-size: var(--text-caption); color: var(--muted);
    cursor: pointer;
}
.search-option input[type="checkbox"] { cursor: pointer; }
.search-option input[type="number"] {
    width: 50px; padding: 2px 4px;
    background: var(--inset);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: var(--radius-sm);
}
.search-progress {
    display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0;
}
.progress-bar {
    flex: 1; height: 4px; background: var(--surface-2);
    border-radius: 2px; overflow: hidden;
}
.progress-fill {
    height: 100%; background: var(--vscode-progressBar-background);
    width: 0%; transition: width 0.15s ease-out;
}
.progress-text { font-size: var(--text-caption); color: var(--muted); }
.hidden { display: none !important; }

.results-section {
    flex: 1; padding: 0 16px 16px;
    overflow-y: auto;
}
.results-header {
    font-size: var(--text-caption); color: var(--muted);
    margin-bottom: var(--space-2); padding-top: var(--space-2);
}
.search-time { opacity: 0.7; }
.search-cancelled {
    padding: var(--space-4); text-align: center;
    color: var(--accent-warning);
    font-style: italic;
}
.result-group { margin-bottom: var(--space-3); }
.result-group-header {
    font-size: var(--text-caption); font-weight: 600;
    padding: var(--space-1) 0; display: flex; align-items: center; gap: 6px;
}
.result-group-name { flex-shrink: 0; }
.result-group-count { color: var(--muted); }
.result-group-sidecar {
    font-size: 9px; padding: 1px 4px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: var(--radius-sm); text-transform: uppercase;
}
.result-group-warning { margin-left: var(--space-1); cursor: help; }
.result-context {
    padding: 2px 8px 2px 20px;
    cursor: pointer; border-radius: var(--radius-sm);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    opacity: 0.5;
}
.result-context:hover { background: var(--vscode-list-hoverBackground); opacity: 0.7; }
.result-context .context-line { font-style: italic; }
.result-item {
    padding: 4px 8px 4px 20px;
    cursor: pointer; border-radius: var(--radius-sm);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.result-item:hover { background: var(--vscode-list-hoverBackground); }
.result-line {
    color: var(--muted);
    margin-right: var(--space-2);
}
.result-match { background: var(--vscode-editor-findMatchHighlightBackground); }
.result-truncated {
    padding: 4px 20px;
    font-size: var(--text-caption); font-style: italic;
    color: var(--muted);
}
.source-warning { margin-right: var(--space-1); }

.notes-section { padding: var(--space-3) var(--space-4); }
.notes-textarea {
    width: 100%; min-height: 80px;
    background: var(--inset);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px; padding: var(--space-2);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: 12px; resize: vertical;
}
.notes-textarea:focus { border-color: var(--vscode-focusBorder); outline: none; }

.actions-bar {
    display: flex; gap: var(--space-2); padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border);
    background: var(--vscode-sideBar-background);
    flex-shrink: 0;
}

.loading {
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-6); color: var(--muted);
}
.spinner {
    width: 16px; height: 16px; border: 2px solid var(--muted);
    border-top-color: transparent; border-radius: 50%;
    animation: spin 0.8s linear infinite; margin-right: var(--space-2);
}
@keyframes spin { to { transform: rotate(360deg); } }

.no-collection {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100%; padding: var(--space-6);
    text-align: center; color: var(--muted);
}
.no-collection-icon { font-size: 48px; opacity: 0.3; margin-bottom: var(--space-4); }
.no-collection-title { font-size: 16px; font-weight: 600; margin-bottom: var(--space-2); color: var(--text); }
.no-collection-text { font-size: var(--text-body); margin-bottom: var(--space-4); max-width: 280px; }
`;
}
