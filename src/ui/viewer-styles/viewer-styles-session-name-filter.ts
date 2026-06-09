/**
 * Styles for the session-list name filter bar: the verb label, the removable
 * per-name pills, and the "Show All" clear button. Extracted from
 * viewer-styles-session-list.ts to keep that file under the 300-line limit
 * (see `.claude/rules/global.md`). Composed by viewer-styles-session.ts in the
 * same `<style>` block as the rest of the session-panel styles.
 */

export function getSessionNameFilterStyles(): string {
    return /* css */ `

/* --- Name filter bar --- */
.session-name-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--vscode-editorInfo-background, rgba(55, 148, 255, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-foreground);
}
.session-name-filter-label {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
/* Pills wrap onto multiple rows as names accumulate, and take the flexible width
   so the verb label and "Show All" button keep their natural size at the ends. */
.session-name-filter-pills {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.session-name-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    padding: 1px 2px 1px 6px;
    border-radius: 9px;
    background: var(--vscode-badge-background, rgba(120, 120, 120, 0.3));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
}
.session-name-filter-pill-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.session-name-filter-pill-remove {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 1px;
    margin: 0;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    border-radius: 50%;
}
.session-name-filter-pill-remove:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.session-name-filter-pill-remove .codicon {
    font-size: 12px;
}
.session-name-filter-clear {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: 1px solid var(--vscode-button-border, transparent);
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}
.session-name-filter-clear:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
`;
}
