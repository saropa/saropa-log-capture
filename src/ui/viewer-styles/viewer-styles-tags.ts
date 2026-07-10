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
/* The summary row has no control inside it — the generic .options-row cursor:pointer
   (meant for rows that wrap a checkbox/radio label) otherwise reads as a false
   clickable affordance on plain informational text (2026-07-10). */
.options-row:has(.source-tag-summary) {
    cursor: default;
}

/* --- Tag search box: filters the chip list live as the user types --- */
.source-tag-search {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin: 2px 0 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    outline: none;
}
.source-tag-search:focus {
    border-color: var(--vscode-focusBorder);
}
.source-tag-no-match {
    font-size: 11px;
    opacity: 0.7;
    padding: 4px 2px;
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

/* --- Show all / Show less toggle — used by Class Tags (viewer-class-tags.ts) and
   Session Tags (viewer-session-tags.ts). The Message Tags (source-tag) panel no
   longer uses this: it always shows every tag and offers search instead (2026-07-10). --- */
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
    /* line-height: 1 (not inherited) — .line sets line-height to a unitless 1.1, which
       is a RATIO, not a fixed px value, so it recomputes against THIS element's own
       10px font (11px) rather than the row's 13px font. Chip box height was then
       11(text) + 4(padding) + 2(border) = 17px against a ~14.3px fixed row height
       (calc(1em * 1.1) at the default 13px log font) — the row's overflow:hidden
       clipped the excess, shearing off exactly the bottom border first (the
       outermost pixel), which read as "missing bottom border" plus row-to-row
       height looking inconsistent (only rows with a chip clipped). Matches the
       line-height:1 pattern already used by .level-letter/.dot-count for the same
       reason. */
    line-height: 1;
    padding: 1px 6px;
    border-radius: 3px;
    margin-right: 4px;
    white-space: nowrap;
    color: var(--tag-c);
    background: color-mix(in srgb, var(--tag-c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--tag-c) 40%, transparent);
}
/* Log-line tag chips are clickable — they open the Message Tags sidebar. */
.tag-chip[data-tag-chip] { cursor: pointer; }
.tag-chip[data-tag-chip]:hover { background: color-mix(in srgb, var(--tag-c) 28%, transparent); }
/* Brief flash on the sidebar chip a log chip click scrolled to. */
@keyframes tag-chip-flash-kf {
    0% { box-shadow: 0 0 0 2px var(--vscode-focusBorder, #4aa5ff); }
    100% { box-shadow: 0 0 0 2px transparent; }
}
.source-tag-chip.tag-chip-flash { animation: tag-chip-flash-kf 1.2s ease-out; }
/* Level-specific tag coloring — matches level dots in viewer-styles-level.ts */
.tag-chip.tag-level-error       { --tag-c: var(--vscode-charts-red, #f14c4c); }
.tag-chip.tag-level-warning     { --tag-c: var(--vscode-charts-yellow, #e2c08d); }
.tag-chip.tag-level-performance { --tag-c: var(--vscode-charts-purple, #b180d7); }
.tag-chip.tag-level-database    { --tag-c: var(--vscode-charts-green, #89d185); }
.tag-chip.tag-level-todo        { --tag-c: var(--vscode-charts-foreground, #cccccc); }
.tag-chip.tag-level-notice      { --tag-c: var(--vscode-charts-blue, #4aa5ff); }
.tag-chip.tag-level-debug       { --tag-c: var(--vscode-descriptionForeground, #9d9d9d); }
.tag-chip.tag-level-info        { --tag-c: var(--vscode-charts-blue, #4aa5ff); }
`;
}
