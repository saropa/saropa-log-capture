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
.bar-bridge::before { display: none; }
/* Blank lines: no dot, keep vertical bar (connector) */
.line-blank[class*="level-bar-"]::before { display: none; }

/* Severity-gutter decoupling (plan: bugs/048_plan-severity-gutter-decoupling.md).
   The prior .bar-hidden-rows outlined-dot state was overloaded with FOUR
   different concepts (filter-hidden gap, expanded peek anchor, dedup-fold
   survivor, collapsed stack header) and the dot looked identical for
   "click to expand" and "click to collapse" — clicking it removed lines
   from view in a way users perceived as data deletion. The state has been
   removed entirely. Each concept now has its own dedicated affordance:
     - filter gaps + peek brackets : .viewer-divider sibling rows
                                     (viewer-styles-collapse-controls.ts)
     - dedup-fold survivors        : inline .dedup-badge
     - collapsed stack headers     : inline .stack-toggle chevron
     - preview-mode trimmed frames : .viewer-divider sibling row
   The interim .peek-collapse-row / .peek-collapse-link (the surgical
   fix from commit 4a4d1590) is also gone — its job is done by the
   trailing .viewer-divider on expanded peek groups. */

/* Connector bars join consecutive dots — scale with zoom via em */
.bar-down::after, .bar-up::after {
    content: ''; position: absolute; left: 0.89em; width: 0.14em;
    /* Bumped from 45% to 70%. At 45% the connector was faint enough that the
       1-row empty gutter at a color transition read as a continuous faint
       line, not a break — users perceived the gutter as "joining between
       colors." At 70% the stripe is vivid enough that its absence at a chain
       boundary is unmistakably empty space. color-mix replaces opacity so
       the gutter stripe never paints on top of the severity dot (::before)
       — opacity on ::after interacted with stacking contexts in Chromium/
       WebKit. */
    background: color-mix(in srgb, var(--bar-color) 70%, transparent);
    pointer-events: none;
    /* Below severity dot (::before); keep above unpositioned row content via positive z-index. */
    z-index: 1;
}
.bar-down:not(.bar-up)::after { top: 50%; bottom: 0; }
.bar-up:not(.bar-down)::after { top: 0; bottom: 50%; }
.bar-up.bar-down::after { top: 0; bottom: 0; }

/* History: pre-2026.04 the viewer used .hidden-chevron (▼) and .peek-collapse
   (−) elements between visible rows. The 2026.04 unified line-collapsing
   rethink replaced them with the overloaded .bar-hidden-rows outlined-dot
   state. The 2026.05 severity-gutter decoupling (plan 048) replaced THAT
   with dedicated .viewer-divider / .dedup-badge / .stack-toggle affordances
   (see viewer-styles-collapse-controls.ts). Nothing in the render pipeline
   emits any of the retired classes anymore. */

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
`;
}
