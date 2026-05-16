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
 * `.stack-toggle` remains for stack-header rows because they have no
 * line-number prefix to attach a chevron to; it renders inline at the
 * start of the header text (NOT absolute-positioned, NOT in the tag
 * column — see viewer-data-helpers-render-stack.ts).
 *
 * Concatenated into the bundled stylesheet via viewer-styles-decoration.ts.
 */
export function getCollapseControlStyles(): string {
    return /* css */ `

/* ===================================================================
   Counter-row chevron — clickable line-number + ▶ / ▼ on rows that
   own expandable / collapsible hidden content below them.
   =================================================================== */

/* The wrapper is a real layout span inside the .line-decoration prefix,
   so it adds nothing exotic to row geometry — no absolute positioning,
   no overlay z-index games. Its width is the counter digits plus a small
   chevron glyph, which sits flush against the right edge of the number.
   Cursor + role expose interactivity; the title attribute carries the
   per-affordance tooltip (count, reason, parsed-tag context). */
.deco-counter-row {
    display: inline-block;
    cursor: pointer;
    border-radius: 2px;
}
.deco-counter-row:hover {
    background: var(--vscode-editor-hoverHighlightBackground, rgba(173, 214, 255, 0.15));
}
.deco-counter-row:hover .deco-chevron,
.deco-counter-row:focus-visible .deco-chevron {
    color: var(--vscode-foreground, #fff);
    opacity: 1;
}
.deco-counter-row:focus-visible {
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

/* ===================================================================
   Stack toggle — inline chevron at the start of a stack-header's text.
   Kept INLINE (not floating, not absolute) because stack-header rows
   have no decoration prefix to host a counter-row chevron. The whole
   header row remains clickable via the existing handler — the chevron
   is just the visible cue.
   =================================================================== */
.stack-toggle {
    display: inline-block;
    margin-right: 0.35em;
    color: var(--vscode-descriptionForeground, #888);
    opacity: 0.5;
    cursor: pointer;
    user-select: none;
    font-size: 0.85em;
}
.stack-toggle:hover {
    color: var(--vscode-foreground, #fff);
    opacity: 1;
}
`;
}
