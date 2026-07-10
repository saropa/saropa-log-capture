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

/* --- Head-tag chips (bracket tags rendered in the head-tag column) ---
   One rule reads --tag-c (the level color); each level class only sets the
   variable, and color-mix derives the fill + border from it — the same DRY
   pattern as .flow-chip. Colors are VS Code theme-adaptive --vscode-charts-*
   tokens (readable on dark AND light), replacing the old hardcoded material
   hexes whose dark purple/brown read as dark-on-dark on the editor background. */
.tag-chip {
    --tag-c: var(--vscode-charts-blue, #4aa5ff);
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    margin-right: 4px;
    white-space: nowrap;
    color: var(--tag-c);
    background: color-mix(in srgb, var(--tag-c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--tag-c) 40%, transparent);
}
/* Level-specific tag coloring — matches level dots in viewer-styles-level.ts */
.tag-chip.tag-level-error       { --tag-c: var(--vscode-charts-red, #f14c4c); }
.tag-chip.tag-level-warning     { --tag-c: var(--vscode-charts-yellow, #e2c08d); }
.tag-chip.tag-level-performance { --tag-c: var(--vscode-charts-purple, #b180d7); }
.tag-chip.tag-level-database    { --tag-c: var(--vscode-charts-green, #89d185); }
.tag-chip.tag-level-todo        { --tag-c: var(--vscode-charts-foreground, #cccccc); }
.tag-chip.tag-level-notice      { --tag-c: var(--vscode-charts-blue, #4aa5ff); }
.tag-chip.tag-level-debug       { --tag-c: var(--vscode-descriptionForeground, #9d9d9d); }
.tag-chip.tag-level-info        { --tag-c: var(--vscode-charts-blue, #4aa5ff); }
/* Overflow badge: shows +N when a line carries more head tags than the fixed
   column shows. Neutral (it is a count, not a severity); the full list is on
   the cell title. No margin-right — it is the last chip in the cell. */
.tag-chip.tag-chip-more {
    --tag-c: var(--vscode-descriptionForeground, #9d9d9d);
    margin-right: 0;
    font-weight: 600;
}
`;
}
