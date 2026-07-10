/**
 * CSS styles for severity bars, line tinting, connectors, hidden-line chevrons,
 * continuation badges, and error classification badges.
 *
 * Split from `viewer-styles-decoration.ts` which covers the decoration prefix
 * and settings panel.
 */
export function getDecorationBarStyles(): string {
    /* Connector color GROUPS. A run of dots joins into one band only when
       consecutive rows share a color; a color change must show a clean break.
       Each entry is a selector matching ANY row of that color. All are 1:1 with a
       single level-bar class EXCEPT the blue group: info and framework are
       different classes that resolve to the SAME --vscode-charts-blue, so they
       must count as one color (this is exactly what the old exact-class chain got
       wrong — a mixed info/framework run looked identical yet never joined). */
    const barColorGroups = [
        '.level-bar-error',
        '.level-bar-error-recent-context',
        '.level-bar-warning',
        '.level-bar-performance',
        '.level-bar-todo',
        '.level-bar-debug',
        '.level-bar-notice',
        '.level-bar-database',
        '.level-bar-ai',
        ':is(.level-bar-info, .level-bar-framework)',
    ];
    /* Per-group half-stripe extensions of the collapsed base ::after (below).
       Generated from the one array so the 10 groups stay DRY. For each group g:
         - g:has(+ g)  → paint the BOTTOM half (dot center -> row bottom), i.e.
           connect DOWN to the next dot, but only when it is the same color.
         - g + g       → paint the TOP half (row top -> dot center) on the second
           row, i.e. connect UP to the previous same-color dot.
       A row in the middle of a same-color run matches both, giving a full-height
       segment; a row at a color boundary matches neither on the boundary side, so
       no half is painted there and the two differently colored dots stand apart.
       Placed AFTER the base rule: these tie it on specificity, so source order
       makes them win. */
    const connectorJoins = barColorGroups.map((g) =>
        `${g}:has(+ ${g})::after { bottom: 0; }\n${g} + ${g}::after { top: 0; }`,
    ).join('\n');
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

/* Positioning context for severity dots and connector bars.
   --gutter-cx is the ONE horizontal center shared by the dot (::before) and the
   connector (::after). Both anchor here and self-center with translateX(-50%), so
   a 0.44em dot and a thin stripe compute their left edge from the SAME reference
   and can never round to different sub-pixels — the cause of the line looking
   off-center under the dots (user report 2026-07-10). Was: dot left 0.74em (+0.22
   half = center 0.96em), stripe left 0.89em (+0.07 half = center 0.96em) — equal
   in math, mismatched after independent sub-pixel rounding. */
#viewport { position: relative; --gutter-cx: 0.96em; }

/* Severity dot mode (colored circle on timeline) — scale with zoom via em */
[class*="level-bar-"] { z-index: 1; }
[class*="level-bar-"]::before {
    content: ''; position: absolute;
    left: var(--gutter-cx); transform: translateX(-50%);
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
/* AI activity rows: one dedicated gutter color (magenta) so a run of Claude Code
   activity reads as its own joined band, exactly like every severity run — this
   replaced the old .ai-line box-shadow left rail, which sat in its own column and
   read as a SECOND severity bar (user report 2026-07-10). The gutter dot answers
   "is this AI activity"; the per-action color (edit/bash/ask/read/system) lives in
   the .ai-tag-chip, so the single dot color loses no information. Magenta is unused
   by any severity level above, so AI never collides with a real severity color. */
.level-bar-ai { --bar-color: var(--vscode-terminal-ansiMagenta, #bc3fbc); }
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

/* Connector stripe joining consecutive SAME-COLOR dots (and only those).
   The base rule establishes a COLLAPSED ::after box for every leveled, non-art,
   non-blank row — centered on --gutter-cx (see #viewport) so it sits exactly
   under the dot — but with top:50%/bottom:50% it has zero height and paints
   nothing on its own. The generated ${connectorJoins} rules below extend the
   bottom half toward the next dot (g:has(+ g)) and the top half toward the
   previous dot (g + g) ONLY when the neighbor shares the color group. So a
   segment is drawn strictly BETWEEN two same-color dots; at a color change no
   half is painted around the boundary and the differently colored dots stand
   apart with a clean break.

   WHY this shape (2026-07-10):
     - Attempt 3 (a full-height class-agnostic stripe) had adjacent yellow and
       blue stripes touch at the shared row boundary, so a color change looked
       joined (user: "you regressed by joining NON-matching colors"). Gating each
       half on the neighbor's color group removes exactly that bridge.
     - The halves fill to the row EDGES (not center-to-center), so the band stays
       continuous and exact across variable row heights — Attempt 3's one real
       virtue — and never overshoots the row, so .line can still clip overflow.
     - Joining by COLOR GROUP (not exact class) keeps info + framework — same
       blue, different class — as one band (Attempt 2 got this wrong).
   The art-block/blank exclusion frees ::after for ASCII-art shimmer and keeps
   dot-less blank rows out of the band; a same-color run straddling a blank shows
   a one-row gap, which is accepted. See bugs/severity_dot_join_attempts.md. */
[class*="level-bar-"]:not(:is(.art-block-start, .art-block-middle, .art-block-end, .line-blank))::after {
    content: ''; position: absolute;
    /* Center-anchored on the SAME --gutter-cx as the dot; widened to 0.16em for
       a solid seam (the user allowed a wider line rather than any fractional
       left offset to fake centering). */
    left: var(--gutter-cx); width: 0.16em; transform: translateX(-50%);
    top: 50%;
    bottom: 50%;
    /* color-mix at 45% (not opacity) — opacity on ::after interacted with
       Chromium/WebKit stacking contexts so the stripe could paint on top of
       the severity dot (::before). */
    background: color-mix(in srgb, var(--bar-color) 45%, transparent);
    pointer-events: none;
    /* Below the severity dot (::before z-index: 2) so the dot stays on top at
       its center point and remains the focal element. */
    z-index: 1;
}
/* Generated per-color-group half-stripe extensions (see barColorGroups above). */
${connectorJoins}

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
