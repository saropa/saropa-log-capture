/**
 * CSS styles for structured file format rendering (plan 051).
 * Covers markdown, JSON, and CSV formatted views.
 */

/** Returns CSS for structured file format modes. */
export function getFormatStyles(): string {
    return /* css */ `

/* ---- Format toggle button active state ---- */

.toolbar-icon-btn-active {
    background: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.12));
    border-radius: 4px;
}

/* ---- Markdown ---- */

.md-heading {
    font-weight: bold;
    cursor: pointer;
    display: inline-block;
    width: 100%;
}
.md-heading:hover { opacity: 0.8; }

.md-h1 { font-size: 1.4em; border-left: 3px solid var(--vscode-textLink-foreground, #3794ff); padding-left: 6px; }
.md-h2 { font-size: 1.25em; border-left: 3px solid var(--vscode-textLink-foreground, #3794ff); padding-left: 6px; }
.md-h3 { font-size: 1.1em; border-left: 2px solid var(--vscode-descriptionForeground, #888); padding-left: 6px; }
.md-h4 { font-size: 1.0em; }
.md-h5 { font-size: 0.95em; }
.md-h6 { font-size: 0.9em; color: var(--vscode-descriptionForeground, #888); }

.md-collapse-badge {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground, #888);
    font-weight: normal;
    margin-left: 8px;
}

.md-hr {
    display: block;
    border: none;
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
    margin: 2px 0;
    height: 0;
}

.md-blockquote {
    display: inline-block;
    border-left: 2px solid var(--vscode-textBlockQuote-border, #555);
    padding-left: calc(var(--bq-depth, 1) * 8px);
    color: var(--vscode-descriptionForeground, #999);
    font-style: italic;
}

.md-bullet {
    padding-left: calc(var(--md-indent, 0) * 12px + 16px);
}

.md-code {
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    border-radius: 3px;
    padding: 1px 4px;
    font-family: var(--vscode-editor-font-family);
}

.md-link {
    text-decoration: underline;
    color: var(--vscode-textLink-foreground, #3794ff);
}

.md-table-row {
    font-family: var(--vscode-editor-font-family);
}

.md-table-sep {
    color: var(--vscode-descriptionForeground, #666);
}

/* ---- JSON ---- */

.json-line {
    padding-left: calc(var(--json-depth, 0) * 16px);
    cursor: default;
}
.json-line[data-json-section] { cursor: pointer; }
.json-line[data-json-section]:hover { opacity: 0.8; }

.json-key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
.json-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
.json-number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
.json-bool { color: var(--vscode-debugTokenExpression-boolean, #4fc1ff); }
.json-brace { color: var(--vscode-descriptionForeground, #888); }

.json-collapse-badge {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
    margin-left: 4px;
}

/* ---- CSV ---- */

.csv-row {
    font-family: var(--vscode-editor-font-family);
    white-space: pre;
}

.csv-header-row {
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
}

.csv-alt-row {
    background: rgba(255, 255, 255, 0.02);
}

.csv-cell {
    display: inline-block;
    padding: 0 4px;
}

.csv-header-cell {
    display: inline-block;
    padding: 0 4px;
    font-weight: bold;
}

.csv-sep {
    color: var(--vscode-descriptionForeground, #555);
    padding: 0 2px;
}

/* ---- Generic format line wrapper ---- */

.fmt-markdown,
.fmt-json,
.fmt-csv,
.fmt-html {
    /* No level-based coloring for structured documents. */
    color: var(--vscode-editor-foreground, #d4d4d4);
}
`;
}
