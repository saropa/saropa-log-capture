/**
 * CSS for the dedicated collapse / expand affordances introduced by
 * bugs/048_plan-severity-gutter-decoupling.md.
 *
 * Replaces the prior overloaded outlined-dot state (.bar-hidden-rows) on
 * the severity gutter. Each expand/collapse concept now has its own
 * affordance so the gutter reads as purely informational:
 *   .viewer-divider — full-row-width thin button bar (filter-hidden gaps,
 *                     peek leading/trailing brackets, preview-mode notice).
 *   .dedup-badge   — inline "×N" pill at the end of a dedup-fold survivor.
 *   .stack-toggle  — inline chevron inside a stack-header's text.
 *
 * Concatenated into the bundled stylesheet via viewer-styles-decoration.ts.
 */
export function getCollapseControlStyles(): string {
    return /* css */ `

/* ===================================================================
   Viewer dividers — bracket expanded peek ranges and surface
   filter-hidden gaps as their own row, not a gutter overload.
   =================================================================== */

/* WHY a full-row bar instead of a small icon: a control whose entire
   body says what it does and what will happen leaves no room for the
   "is this informational or interactive?" misreading that the
   overloaded outlined dot suffered from. Width also gives room for
   the count + reason text. */
.viewer-divider {
    height: max(8px, calc(0.7 * 1em * var(--log-line-height, 1.1)));
    line-height: 1;
    text-align: center;
    user-select: none;
    cursor: pointer;
    /* WHY no margin: the divider sits flush against the row it belongs to
       so its position reads unambiguously as "this row's expand control".
       Margin would visually detach it and weaken the association. */
    margin: 0;
}
.viewer-divider:hover .viewer-divider-label {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}
.viewer-divider-label {
    display: inline-block;
    padding: 0.05em 0.6em;
    font-size: 0.78em;
    color: var(--vscode-descriptionForeground, #888);
    background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 30%, transparent);
    border-radius: 0.25em;
}
/* If the bar-bridge post-pass added level-bar-* to this row (because it
   sat between two same-level severity dots), suppress the dot — the row
   is a control, not a log line, and a severity dot on it would be
   misleading (same WHY as .peek-collapse-row's prior rule). */
.viewer-divider[class*="level-bar-"]::before { display: none; }

/* ===================================================================
   Dedup badge — inline "×N" pill at the end of a dedup-fold survivor.
   =================================================================== */

/* WHY an inline trailing badge on the survivor (not a divider above or
   below): the survivor IS a real visible row carrying real text. A
   divider on either side would be ambiguous about which row owns the
   fold. An inline trailing badge is unambiguously attached to the
   survivor it folds. */
.dedup-badge {
    display: inline-block;
    margin-left: 0.5em;
    padding: 0.05em 0.45em;
    font-size: 0.75em;
    font-weight: 600;
    color: var(--vscode-descriptionForeground, #888);
    background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 35%, transparent);
    border-radius: 0.25em;
    cursor: pointer;
    user-select: none;
    vertical-align: baseline;
}
.dedup-badge:hover {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}
/* When the dedup peek is expanded the badge mutates to "×N hide"; the
   slightly higher contrast tells the user the click action has flipped. */
.dedup-badge.dedup-badge-expanded {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

/* ===================================================================
   Stack toggle — inline chevron inside a stack-header's text.
   =================================================================== */

/* WHY inline (not in the gutter): convention. Every IDE, debugger, file
   explorer, and JSON viewer uses inline chevrons for collapsible
   regions. Putting them in the severity gutter (as the prior outlined
   dot did) was novel for novelty's sake. The whole stack-header row
   stays clickable via the existing handler in
   viewer-script-click-handlers.ts; the chevron is the visual cue so
   the user does not need to read the tooltip to learn the row is a
   toggle. */
.stack-toggle {
    display: inline-block;
    margin-right: 0.35em;
    color: var(--vscode-descriptionForeground, #888);
    cursor: pointer;
    user-select: none;
    /* Fixed width so collapsed (▶) and expanded (▼) line up vertically
       and the header text does not jitter horizontally on toggle. */
    width: 0.9em;
    text-align: center;
}
.stack-toggle:hover {
    color: var(--vscode-foreground, #fff);
}
`;
}
