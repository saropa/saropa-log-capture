/**
 * CSS styles for source tag chips in the viewer webview.
 *
 * Chips appear in the Message Tags section of the options panel, showing
 * discovered source tags (e.g. logcat tags like "flutter", "FirebaseSessions").
 * Each chip shows the tag name and line count; clicking toggles visibility.
 */
export function getTagStyles(): string {
    return /* css */ `

/* ===================================================================
   Source Tag Strip (legacy container, kept for reusable chip styles)
   =================================================================== */
.source-tag-strip {
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.source-tag-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    user-select: none;
}
.source-tag-header:hover {
    background: var(--vscode-list-hoverBackground);
}
.source-tag-chevron {
    font-size: 10px;
    width: 12px;
    text-align: center;
}
.source-tag-summary {
    font-size: 10px;
    opacity: 0.7;
    margin-left: auto;
}

/* --- Chip container: flex-wrap, shown when tags exist --- */
.source-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 6px;
    align-items: center;
}
/* Inside options panel, use tighter padding */
.source-tag-chips.options-tags {
    padding: 4px 0 2px;
}

/* --- Individual tag chip: pill-shaped toggle button --- */
.source-tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
    background: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    white-space: nowrap;
    opacity: 0.5;
    transition: opacity 0.15s, background 0.15s;
}
.source-tag-chip.active {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    opacity: 1;
}
.source-tag-chip:hover {
    background: var(--vscode-list-hoverBackground);
    opacity: 1;
}
.source-tag-chip.tag-overflow { display: none; }
.source-tag-chip .codicon { font-size: 11px; line-height: 1; }
.tag-count {
    font-size: 9px;
    opacity: 0.7;
    font-weight: bold;
}

/* --- All / None action links at the start of the chip row --- */
.source-tag-actions {
    display: flex;
    gap: 2px;
    margin-right: 4px;
}
.tag-action-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-size: 10px;
    cursor: pointer;
    padding: 0 4px;
}
.tag-action-btn:hover {
    text-decoration: underline;
}

/* --- Show all / Show less toggle in tag sections --- */
.tag-show-all-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 8px;
    width: 100%;
    text-align: center;
}
.tag-show-all-btn:hover { text-decoration: underline; }

/* --- Inline tag links in rendered log lines --- */
.tag-link {
    color: var(--tag-clr) !important;
    cursor: pointer;
    border-radius: 2px;
    padding: 0 1px;
    transition: background 0.1s, text-decoration 0.1s;
}
.tag-link:hover {
    text-decoration: underline;
    background: rgba(255, 255, 255, 0.08);
}

/* --- Head-tag chips (bracket tags rendered inline in lines) --- */
.tag-chip {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    margin-right: 4px;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--vscode-foreground);
}
/* Level-specific tag coloring — matches level dots in viewer-styles-level.ts */
.tag-chip.tag-level-error {
    border-color: #f44336;
    color: #f44336;
    background: rgba(244, 67, 54, 0.1);
}
.tag-chip.tag-level-warning {
    border-color: #ff9800;
    color: #ff9800;
    background: rgba(255, 152, 0, 0.1);
}
.tag-chip.tag-level-performance {
    border-color: #9c27b0;
    color: #9c27b0;
    background: rgba(156, 39, 176, 0.1);
}
.tag-chip.tag-level-database {
    border-color: #4caf50;
    color: #4caf50;
    background: rgba(76, 175, 80, 0.1);
}
.tag-chip.tag-level-todo {
    border-color: #bdbdbd;
    color: #bdbdbd;
    background: rgba(189, 189, 189, 0.1);
}
.tag-chip.tag-level-notice {
    border-color: #00bcd4;
    color: #00bcd4;
    background: rgba(0, 188, 212, 0.1);
}
.tag-chip.tag-level-debug {
    border-color: #a1887f;
    color: #a1887f;
    background: rgba(161, 136, 127, 0.1);
}
.tag-chip.tag-level-info {
    border-color: #2196f3;
    color: #2196f3;
    background: rgba(33, 150, 243, 0.1);
}
`;
}
