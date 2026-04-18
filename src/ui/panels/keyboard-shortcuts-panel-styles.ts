/**
 * CSS for the standalone keyboard shortcuts reference panel.
 *
 * Uses VS Code theme variables so it looks native in any theme.
 * The layout is a simple reference document: heading, intro text,
 * grouped tables with three columns (key, action, description).
 */

/** Returns the CSS string for the keyboard shortcuts panel. */
export function getKeyboardShortcutsPanelStyles(): string {
    return `
body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 24px 32px;
    line-height: 1.6;
    max-width: 960px;
    margin: 0 auto;
}

h1 {
    font-size: 1.6em;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--vscode-foreground);
}

h2 {
    font-size: 1.15em;
    font-weight: 600;
    margin: 28px 0 8px;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, rgba(128,128,128,0.2)));
    padding-bottom: 4px;
}

.intro {
    color: var(--vscode-descriptionForeground);
    margin: 0 0 20px;
    line-height: 1.5;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
}

thead th {
    text-align: left;
    font-weight: 600;
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    padding: 6px 12px 6px 0;
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, rgba(128,128,128,0.2)));
}

tbody tr {
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, rgba(128,128,128,0.07)));
}

tbody tr:hover {
    background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.06));
}

td {
    padding: 7px 12px 7px 0;
    vertical-align: top;
}

/* Column widths */
.key-col { width: 140px; white-space: nowrap; }
.name-col { width: 180px; white-space: nowrap; font-weight: 500; }
.desc-col { color: var(--vscode-descriptionForeground); }

/* Search bar */
.search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    position: sticky;
    top: 0;
    background: var(--vscode-editor-background);
    padding: 8px 0;
    z-index: 1;
}

.search-bar input {
    flex: 1;
    padding: 6px 10px;
    font-size: var(--vscode-font-size, 13px);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    color: var(--vscode-input-foreground, var(--vscode-foreground));
    background: var(--vscode-input-background, rgba(128,128,128,0.1));
    border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.3));
    border-radius: 4px;
    outline: none;
}

.search-bar input:focus {
    border-color: var(--vscode-focusBorder, #007acc);
}

.search-bar input::placeholder {
    color: var(--vscode-input-placeholderForeground, rgba(128,128,128,0.6));
}

.search-bar button {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    font-size: 1.2em;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 3px;
    line-height: 1;
}

.search-bar button:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15));
}

.match-count {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

kbd {
    display: inline-block;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 0.9em;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.15));
    color: var(--vscode-keybindingLabel-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-keybindingLabel-border, rgba(128,128,128,0.25));
    box-shadow: 0 1px 0 var(--vscode-keybindingLabel-bottomBorder, rgba(0,0,0,0.15));
}
`;
}
