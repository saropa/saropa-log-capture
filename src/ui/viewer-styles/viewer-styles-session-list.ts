/**
 * Session list items, day headings, context menu, and severity dots styles.
 * Composed by viewer-styles-session.ts.
 */

/** Session list and item styles. */
export function getSessionListStyles(): string {
    return /* css */ `

/* --- Session list items --- */
.session-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.session-item-selected {
    background: var(--vscode-list-inactiveSelectionBackground, var(--vscode-list-hoverBackground));
}
.session-item-selected:hover {
    background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
}

.session-item-active .session-item-icon .codicon {
    color: var(--vscode-charts-red, #f44336);
}

/* Recent-updates indicators: orange = new since last viewed, red = updated in last minute */
.session-item-update-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: 4px;
    flex-shrink: 0;
    vertical-align: middle;
    transition: opacity 0.15s ease;
}
.session-item-updated-recent .session-item-update-dot { background: var(--vscode-charts-red, #f44336); }
.session-item-updated-since-viewed .session-item-update-dot { background: var(--vscode-charts-orange, #e65100); }

.session-item-icon {
    user-select: none;
    display: inline-flex;
    align-items: center;
}
.session-item-icon .codicon {
    font-size: 14px;
    margin-top: 2px;
}

.session-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.session-item-name {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.session-item-perf {
    display: inline-flex;
    margin-left: 4px;
    vertical-align: middle;
    color: var(--vscode-charts-purple, #b267e6);
    font-size: 12px;
}
.session-item-perf .codicon { font-size: 12px; }

.session-item-loaded {
    display: inline-flex;
    margin-left: 4px;
    vertical-align: middle;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}
.session-item-loaded .codicon { font-size: 12px; }

.session-item-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Row hover actions (reveal in OS, etc.) --- */
/* Container sits beside the info column. Hidden by default; revealed on row hover
   or keyboard focus. Rendered inline so it participates in the flex row without
   overlaying the meta text. */
.session-item-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s ease;
    pointer-events: none;
}
.session-item:hover .session-item-actions,
.session-item:focus-within .session-item-actions {
    opacity: 1;
    pointer-events: auto;
}
.session-item-action {
    background: transparent;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
}
.session-item-action:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.session-item-action .codicon {
    font-size: 14px;
}

/* --- Latest suffix --- */
.session-latest { opacity: 0.5; font-style: italic; font-size: 11px; margin-left: 3px; }

/* --- Day headings (collapsible) --- */
.session-day-heading {
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    position: sticky;
    top: 0;
    z-index: 1;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 4px;
}
.session-day-heading:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-day-chevron {
    font-size: 12px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
/* File count shown as a pill beside the date label. Uses VS Code's badge tokens
   (--vscode-badge-foreground/-background) — the same pair the workbench uses for its
   own count badges, so contrast stays AA-legible in every theme. No opacity dimming:
   the badge background is what separates it from the heading, not faded text. */
.session-day-count {
    display: inline-block;
    font-weight: 600;
    font-size: 10px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 8px;
    color: var(--vscode-badge-foreground, #ffffff);
    background: var(--vscode-badge-background, #4d4d4d);
    /* Never wrap a comma-grouped count ("1,234") mid-number when the sidebar is narrow. */
    white-space: nowrap;
    flex-shrink: 0;
}

/* Collapsed day group: hide session items. */
.session-day-group.collapsed > .session-day-items {
    display: none;
}

/* Reports bucket / newer-log banner / per-row unread-dot styles live in
   viewer-styles-session-newer.ts — composed alongside this stylesheet by
   viewer-styles-session.ts. Extracted to keep this file under the 300-line limit. */

/* --- Session list pagination --- */
.session-list-pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    flex-shrink: 0;
    transition: opacity 0.15s ease;
}
.session-list-pagination-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-right: auto;
}
.session-list-pagination-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border-radius: 2px;
    cursor: pointer;
}
.session-list-pagination-btn:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground);
}
.session-list-pagination-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

/* --- Filtered-empty hint (shown when filters produce zero results) --- */
.session-empty-filtered {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

/* --- Name filter bar --- styles live in viewer-styles-session-name-filter.ts,
   extracted to keep this file under the 300-line limit. Composed alongside this
   stylesheet by viewer-styles-session.ts in the same <style> block. */

/* --- Session context menu --- */
/* overflow must stay "visible" — the Copy and Export flyout submenus are absolutely-positioned
   children and would be clipped by "overflow: auto". The menu is compact enough (≤13 items) that
   scrolling is unnecessary; the show() logic clamps the menu's top/left to the viewport instead. */
.session-context-menu {
    display: none; position: fixed; z-index: 300;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    padding: 4px 0; min-width: 180px; overflow: visible;
}
.session-context-menu.visible { display: block; }
/* Flip submenu to open leftward when the parent menu is near the right edge of the viewport.
   Mirrors the .context-menu.flip-submenu rule used by the line context menu. */
.session-context-menu.flip-submenu .context-menu-submenu-content { left: auto; right: 100%; }

/* --- Severity count chips ---
 * Renders as a sibling of .session-item-meta (never inside its text), and wraps its own chips
 * rather than clipping: a bare overflow:hidden here would still cut a .sev-pair mid-box on a
 * narrow row (a flex chip isn't a text glyph, so text-overflow ellipsis can't clip it cleanly),
 * silently hiding a category's count. Wrapping to a second line costs row height, not data.
 * The old per-category color dot was removed once the count became a filled colored pill —
 * the pill carries the category color, so the dot was pure duplication. */
.sev-dots { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; row-gap: 2px; font-size: 10px; color: var(--vscode-descriptionForeground); vertical-align: middle; }
.sev-pair { display: inline-flex; align-items: center; }

/* --- Severity count pills ---
 * Each count was faint descriptionForeground gray (inherited from .sev-dots); now a
 * filled high-contrast pill in its category color. Fill + foreground come from the shared
 * --sev-<level> / --sev-<level>-fg tokens (viewer-styles-tokens.ts) — the SAME source the
 * toolbar level pills (.dot-count-*) consume, so a log reads identically in the list and
 * open and the two can never drift. (Before this, the list kept its own hand-copied hexes
 * that had already diverged from the toolbar on warning/debug/todo/perf.) The 'perf'
 * category maps to the --sev-performance token; 'other' has no semantic color and stays the
 * neutral theme badge pair. See the token block for the fixed-fill / WCAG rationale. */
.sev-count {
    /* 9px, one step below the top-bar pill: the sidebar pill now carries a prefix LETTER plus
       the count, and the extra glyph needs the smaller size to fit without widening the row. */
    font-size: 9px;
    font-weight: 700;
    line-height: 15px;
    padding: 0 6px;
    border-radius: 8px;
    letter-spacing: 0.2px;
    color: #fff;
    background: var(--vscode-badge-background);
}
/* Prefix letter inside the pill — no color of its own, so it inherits the pill's per-category
   contrasting foreground (letter and number are the same color on the category fill). */
.sev-count-letter {
    margin-right: 3px;
    user-select: none;
}
.sev-count-error    { background: var(--sev-error);       color: var(--sev-error-fg); }
.sev-count-warning  { background: var(--sev-warning);     color: var(--sev-warning-fg); }
.sev-count-info     { background: var(--sev-info);        color: var(--sev-info-fg); }
.sev-count-debug    { background: var(--sev-debug);       color: var(--sev-debug-fg); }
.sev-count-database { background: var(--sev-database);    color: var(--sev-database-fg); }
.sev-count-perf     { background: var(--sev-performance); color: var(--sev-performance-fg); }
.sev-count-todo     { background: var(--sev-todo);        color: var(--sev-todo-fg); }
.sev-count-notice   { background: var(--sev-notice);      color: var(--sev-notice-fg); }
.sev-count-fw       { background: var(--sev-fw);          color: var(--sev-fw-fg); }
/* Residual "other" bucket has no semantic color — keep it the neutral theme badge pair. */
.sev-count-other    { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
`;
}
