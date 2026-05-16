/**
 * CSS for the unified expand / collapse affordance: a small chevron rendered
 * immediately right of the line number on rows that own hidden content
 * below them. The chevron + counter form one clickable region
 * (`.deco-counter-row`) routed through viewer-peek-chevron.ts via
 * `data-affordance-kind`.
 *
 * Replaces three earlier visual languages — `.viewer-divider` between-row
 * pills, `.dedup-badge` trailing chip, and the absolute-positioned tag-
 * column variants — all of which either overlapped row content, claimed
 * inconsistent vertical space, or required separate state vocabularies.
 *
 * Stack-header chevrons are also retired: the trace's expand/collapse
 * toggle moved to the previous log line's counter-row chevron (kind=
 * "stack"), so the stack-header itself is plain text. See
 * viewer-data-helpers-render-stack.ts and viewer-data-divider.ts.
 *
 * Concatenated into the bundled stylesheet via viewer-styles-decoration.ts.
 */
export function getCollapseControlStyles(): string {
    return /* css */ `

/* ===================================================================
   Counter-row chevron — clickable line-number + ▶ / ▼ on rows that
   own expandable / collapsible hidden content below them.
   =================================================================== */

/* EVERY row wraps counter + chevron in .deco-counter-row, even when no
   affordance applies. Identical DOM structure keeps the inline-formatting
   metrics (baseline alignment, whitespace handling) the same row-to-row,
   so the line-number digits land at the same x on every line. Only rows
   that carry [data-affordance-kind] are interactive — cursor / hover /
   focus styles scope to that attribute so non-interactive rows do not
   advertise themselves as clickable. */
.deco-counter-row {
    display: inline-block;
    border-radius: 2px;
}
.deco-counter-row[data-affordance-kind] {
    cursor: pointer;
}
.deco-counter-row[data-affordance-kind]:hover {
    background: var(--vscode-editor-hoverHighlightBackground, rgba(173, 214, 255, 0.15));
}
.deco-counter-row[data-affordance-kind]:hover .deco-chevron,
.deco-counter-row[data-affordance-kind]:focus-visible .deco-chevron {
    color: var(--vscode-foreground, #fff);
    opacity: 1;
}
.deco-counter-row[data-affordance-kind]:focus-visible {
    outline: 1px dotted var(--vscode-focusBorder);
    outline-offset: 1px;
}

/* The chevron itself: dimmed at rest so the line-number column reads as
   primary, the chevron as a quiet hint. Hover lifts to full opacity (rule
   above). Fixed inline-block width so ▶ and ▼ occupy the same horizontal
   space — toggling state does not jitter the message column. */
.deco-chevron {
    display: inline-block;
    margin-left: 0.25em;
    width: 0.9em;
    text-align: center;
    color: var(--vscode-descriptionForeground, #888);
    opacity: 0.55;
    user-select: none;
    /* font-size 0.85em pulls the glyph slightly smaller than the counter
       digits so it reads as a marker on the number, not a competing
       second character at the same weight. */
    font-size: 0.85em;
}

/* Stack-header inline chevron is fully retired — toggle moved to the
   previous log line's counter-row chevron (kind="stack"). No CSS rule
   for the retired class lives here; the whole-row click handler in
   viewer-script-click-handlers.ts still toggles the trace on row click. */
`;
}
