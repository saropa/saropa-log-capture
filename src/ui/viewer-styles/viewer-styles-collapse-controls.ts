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
/* Hover restores full opacity AND the badge pill so the row reads as a
   button when the user reaches for it. At rest the label stays muted text
   (no background) so a divider in the middle of dense logs whispers
   "N hidden · show" instead of competing with real log lines. */
.viewer-divider:hover .viewer-divider-label {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    opacity: 1;
}
.viewer-divider-label {
    display: inline-block;
    padding: 0.05em 0.6em;
    font-size: 0.78em;
    color: var(--vscode-descriptionForeground, #888);
    background: transparent;
    border-radius: 0.25em;
    /* WHY 0.55: descriptionForeground is already a muted grey, but on the
       common dark themes it still reads as solid text against the editor
       background. Dropping opacity to 0.55 pushes it into "secondary
       affordance" territory — visible enough that users see the count
       and click target, faint enough that scanning real log lines is
       not interrupted. Hover lifts to 1 so the click target is obvious. */
    opacity: 0.55;
}
/* Dividers carry a level-bar-* class when they sit inside a same-level
   chain — the render loop stamps the surrounding chain's level so the
   :has(+ .level-bar-X) sibling selector on the previous row can find a
   matching neighbor and extend the chain stripe through the divider. The
   stripe (::after) IS allowed to paint on the divider — that's what keeps
   the chain visually unbroken across hidden-line gaps. But the dot
   (::before) must stay suppressed: the divider is a control affordance,
   not a log line, and a severity dot on it would read as "this row has
   the level" rather than "the chain passes through here." */
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
    /* Dim the resting state so the chevron reads as a quiet hint rather than
       competing with the header text. Full opacity on hover keeps the
       affordance discoverable without making it shouty when idle. */
    opacity: 0.5;
    cursor: pointer;
    user-select: none;
    /* Fixed width so collapsed (▶) and expanded (▼) line up vertically
       and the header text does not jitter horizontally on toggle. */
    width: 0.9em;
    text-align: center;
}
.stack-toggle:hover {
    color: var(--vscode-foreground, #fff);
    opacity: 1;
}
`;
}
