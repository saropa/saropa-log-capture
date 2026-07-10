/**
 * CSS styles for severity bars, line tinting, connectors, hidden-line chevrons,
 * continuation badges, and error classification badges.
 *
 * Split from `viewer-styles-decoration.ts` which covers the decoration prefix
 * and settings panel.
 */
export function getDecorationBarStyles(): string {
    return /* css */ `

/* Whole-line severity tinting — hues follow the same tokens as bar/text for each level. */
.line.line-tint-error {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 14%, transparent);
}
.line.line-tint-error:hover {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 22%, transparent);
}
.line.line-tint-warning {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 12%, transparent);
}
.line.line-tint-warning:hover {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 20%, transparent);
}
.line.line-tint-performance {
    background-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 12%, transparent);
}
.line.line-tint-performance:hover {
    background-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 20%, transparent);
}
.line.line-tint-todo {
    background-color: rgba(200, 200, 200, 0.08);
}
.line.line-tint-todo:hover {
    background-color: rgba(200, 200, 200, 0.16);
}
.line.line-tint-debug {
    background-color: rgba(220, 220, 170, 0.08);
}
.line.line-tint-debug:hover {
    background-color: rgba(220, 220, 170, 0.16);
}
/* Notice tint: cyan, matches .line.level-notice and .level-bar-notice. */
.line.line-tint-notice {
    background-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #00bcd4) 10%, transparent);
}
.line.line-tint-notice:hover {
    background-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #00bcd4) 18%, transparent);
}
/* Database tint: green, matches .line.level-database and .level-bar-database. */
.line.line-tint-database {
    background-color: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 12%, transparent);
}
.line.line-tint-database:hover {
    background-color: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 20%, transparent);
}
/* Info tint: blue, matches .line.level-info and .level-bar-info. */
.line.line-tint-info {
    background-color: color-mix(in srgb, var(--vscode-charts-blue, #2196f3) 10%, transparent);
}
.line.line-tint-info:hover {
    background-color: color-mix(in srgb, var(--vscode-charts-blue, #2196f3) 18%, transparent);
}

/* Blank/empty lines: set --blank-line-bg to any color to join before/after; when unset, previous line tint shows. */
.line.line-blank {
  background-color: var(--blank-line-bg);
  /* Must match calcItemHeight: Math.max(4, floor(ROW_HEIGHT/4)) while base .line uses
     full ROW_HEIGHT (= 1em × --log-line-height, see viewer-styles-lines.ts). Without
     this, virtual-scroll prefix sums use quarter height but the DOM row stays full
     height — blank gaps look "full size" and scroll height drifts. */
  height: max(4px, calc(0.25 * 1em * var(--log-line-height, 1.1)));
  min-height: 4px;
  /* Empty content: no need for the full strut; keeps the short box visually tight. */
  line-height: 1;
}

/* Positioning context for severity dots and connector bars */
#viewport { position: relative; }

/* Severity dot mode (colored circle on timeline) — scale with zoom via em */
[class*="level-bar-"] { z-index: 1; }
[class*="level-bar-"]::before {
    content: ''; position: absolute; left: 0.74em;
    top: 0; bottom: 0; margin: auto 0;
    width: 0.44em; height: 0.44em; border-radius: 50%;
    /* Above connector ::after — must stay in front where the gutter bar overlaps the dot. */
    pointer-events: none; z-index: 2;
}
/* Gutter dots/connectors use the same --vscode-* tokens as .line.level-* in viewer-styles.ts so bar and text stay aligned. */
.level-bar-error { --bar-color: var(--vscode-debugConsole-errorForeground, #f48771); }
/* Recent-error context (same 2s window as a fault above; not the primary error line). */
.level-bar-error-recent-context { --bar-color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 38%, var(--vscode-panel-border, #555) 62%); }
.level-bar-warning { --bar-color: var(--vscode-debugConsole-warningForeground, #cca700); }
.level-bar-performance { --bar-color: var(--vscode-charts-purple, #a855f7); }
.level-bar-todo { --bar-color: var(--vscode-terminal-ansiWhite, #e5e5e5); }
.level-bar-debug { --bar-color: var(--vscode-terminal-ansiYellow, #dcdcaa); }
.level-bar-notice { --bar-color: var(--vscode-terminal-ansiCyan, #00bcd4); }
.level-bar-framework { --bar-color: var(--vscode-charts-blue, #2196f3); }
.level-bar-database { --bar-color: var(--vscode-charts-green, #4caf50); }
.level-bar-info { --bar-color: var(--vscode-charts-blue, #2196f3); }
[class*="level-bar-"]::before { background: var(--bar-color); }
/* Blank lines: no dot, the connector ::after below still paints across them. */
.line-blank[class*="level-bar-"]::before { display: none; }
/* Stack trace rows (header + frames) belong to the SAME logical output as
   the log line above them — the trace is just "more detail for the line."
   Showing a severity dot on each frame would visually multiply the entry's
   weight. The chain ::after still paints on these rows so the gutter line
   reads as one continuous band through the whole entry; only the dots are
   suppressed. */
.stack-header[class*="level-bar-"]::before,
.line.stack-line[class*="level-bar-"]::before { display: none; }

/* Connector line between consecutive same-level dots.
   Declarative — no JS chain walking. Each row paints its OWN stripe ONLY
   when its immediate next sibling shares the same level-bar-* class. The
   stripe is anchored at this row's middle (top: 50%) and extends downward
   by one row height (height: calc(1em * --log-line-height)), reaching the
   next row's middle exactly. Result:
     - run of N same-level rows → N-1 stripes, each dot connected to the next
     - lone row (no same-level next) → no stripe, just the dot
     - end of a chain (next is different level) → :has() fails on the LAST
       row, no overshoot past its dot — clean termination.
   Single source of truth: the row's own level-bar-* class drives both the
   dot color (::before) and the line color (::after) via --bar-color. They
   cannot disagree because they're both pseudo-elements of the same element
   reading the same custom property.
   One selector per level — listed individually because CSS has no "same
   class as me" combinator. Order doesn't matter; specificity is identical.
   :not(:is(.art-block-start, .art-block-middle, .art-block-end)) excludes
   ASCII-art rows — they reuse ::after for the shimmer animation (and carry no
   gutter rail of their own; the old border-left was removed because it broke
   the box layout), so the chain connector must NOT also claim ::after there or
   it would replace the shimmer with a static stripe. */
.level-bar-error:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-error)::after,
.level-bar-error-recent-context:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-error-recent-context)::after,
.level-bar-warning:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-warning)::after,
.level-bar-performance:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-performance)::after,
.level-bar-todo:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-todo)::after,
.level-bar-debug:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-debug)::after,
.level-bar-notice:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-notice)::after,
.level-bar-framework:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-framework)::after,
.level-bar-database:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-database)::after,
.level-bar-info:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-info)::after {
    content: ''; position: absolute;
    left: 0.89em; width: 0.14em;
    /* Anchor at THIS row's middle (top: 50%) and extend to 50% PAST this
       row's bottom (bottom: -50%) — net height equals one parent-row
       height, reaching exactly the next row's middle where the next dot
       sits. Requires uniform row heights, which we now have: .line and
       .stack-header both use var(--log-line-height, 1.1) (see
       viewer-styles-content.ts comment on stack-header line-height).
       At a level transition the row's :has() check fails so it doesn't
       paint — no overshoot to leak the previous chain's color into the
       next chain's space. .line and .stack-header parents have
       overflow: visible so the stripe paints past the row's bottom edge
       into the next row's top half without clipping. */
    top: 50%;
    bottom: -50%;
    /* color-mix at 45% replaces opacity — opacity on ::after interacted with
       Chromium/WebKit stacking contexts so the gutter stripe could paint on
       top of the severity dot (::before). */
    background: color-mix(in srgb, var(--bar-color) 45%, transparent);
    pointer-events: none;
    /* Below severity dot (::before z-index: 2) so the dot covers the stripe
       at the connection point and remains the focal element. */
    z-index: 1;
}

/* Continuation line collapse badge — inline pill showing hidden line count.
   Toggles group visibility on click. Uses em so it scales with zoom. */
.cont-badge {
    display: inline-block;
    padding: 0.05em 0.35em;
    margin: 0 0.35em;
    border-radius: 0.25em;
    font-size: 0.75em;
    font-weight: 600;
    cursor: pointer;
    color: var(--vscode-descriptionForeground, #888);
    background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 40%, transparent);
    user-select: none;
    vertical-align: baseline;
}
.cont-badge:hover {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

/* Flow-tag chip (plan 109) — replaces a [flowmap] line's raw text with a compact
   verb-colored pill. --flow-c carries the verb color so this single rule stays
   DRY; each verb class only sets the variable. color-mix tints the fill/border
   from that one color, matching the .cont-badge approach above. */
.flow-chip {
    --flow-c: var(--vscode-descriptionForeground, #888);
    display: inline-block;
    padding: 0.05em 0.55em;
    border-radius: 0.9em;
    font-size: 0.8em;
    font-weight: 600;
    line-height: 1.4;
    user-select: none;
    vertical-align: baseline;
    color: var(--flow-c);
    background: color-mix(in srgb, var(--flow-c) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--flow-c) 35%, transparent);
}
.flow-chip-enter   { --flow-c: var(--vscode-charts-blue, #2196f3); }
.flow-chip-back    { --flow-c: var(--vscode-charts-purple, #a855f7); }
.flow-chip-exit    { --flow-c: var(--vscode-descriptionForeground, #888); }
.flow-chip-action  { --flow-c: var(--vscode-charts-green, #4caf50); }
.flow-chip-handoff { --flow-c: var(--vscode-charts-orange, #f97316); }
.flow-chip-error   { --flow-c: var(--vscode-errorForeground, #f48771); }

/* Error classification markers — all four (critical / bug / transient / ANR)
   render as a single emoji absolutely positioned in the gutter, in their OWN
   column, so they never push the log text. WHY absolute: the prior inline
   "🐛 BUG" / "⚡ TRANSIENT" pills were flow content — every classified line's
   text shifted right and broke alignment with the surrounding lines. .line has
   position: relative so these anchor inside the row. The full label is in the
   title tooltip + hover popover; .error-badge-interactive keeps hover/analysis. */
.critical-fire-icon,
.error-badge-gutter {
    position: absolute;
    left: 0.3em;
    top: 0;
    bottom: 0;
    margin: auto 0;
    height: 1em;
    line-height: 1;
    font-size: 0.95em;
    cursor: pointer;
    z-index: 3;
    user-select: none;
}
/* Hide the severity dot on lines carrying a classification icon, so the emoji
   alone acts as the gutter indicator — no duplicated dot, no double-width gutter. */
.line:has(.critical-fire-icon)[class*="level-bar-"]::before,
.line:has(.error-badge-gutter)[class*="level-bar-"]::before { display: none; }

/* DB badge: inline indicator that a line has correlated database queries.
   Inline (not gutter-absolute) so it sits with the other inline badges; click
   opens the related-queries popover. */
.db-query-badge { cursor: pointer; margin-left: 2px; opacity: 0.7; font-size: 0.85em; }
.db-query-badge:hover { opacity: 1; }

/* OpenTelemetry trace badge: line carries a trace id; click opens the backend trace. */
.trace-link-badge { cursor: pointer; margin-left: 2px; opacity: 0.7; font-size: 0.85em; }
.trace-link-badge:hover { opacity: 1; }
`;
}
