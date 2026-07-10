/** CSS for individual log lines, copy float, links, focus indicators, level colors, separators, and no-wrap. */
export function getLineStyles(): string {
    return /* css */ `
/* --- Individual log lines --- */
.line {
    white-space: pre-wrap;
    /* break-all shredded monospace decorations; Debug Console–style wrapping first, break long tokens only if needed. */
    word-break: normal;
    overflow-wrap: anywhere;
    padding: 0 8px 0 1.85em;
    /* Fallback 1.1 matches the JS default in viewer-layout.ts and the package.json
       setting default — keep all three in sync. 1.5 produced ~0.5em of visible intra-line
       leading that users read as a gap between every row in dense logs. */
    line-height: var(--log-line-height, 1.1);
    height: calc(1em * var(--log-line-height, 1.1));
    overflow: visible;
    transition: background 0.1s ease;
}
/* Rows that embed a block-level child (currently: expanded SQL repeat drilldown
   panel inside repeat-notification rows) must grow to fit the panel. WHY a class
   rather than always using min-height on .line: the virtual scroller's prefix
   sums treat each row as exactly calcItemHeight() tall; non-expanded rows must
   stay at the strict fixed height so block-flow positions match the prefix
   sums. The class is applied only when the item carries the open-state flag
   that calcItemHeight() also reads, keeping DOM and scroll math in sync.
   Failure mode this avoids: clicking "N × SQL repeated:" expands the panel,
   the .line stays 1em tall, overflow: visible lets the panel paint on top
   of the next 5–10 rows, hiding real log content. */
.line.line-has-block {
    height: auto;
    min-height: calc(1em * var(--log-line-height, 1.1));
}
/* Chip rows (repeat-notification, n-plus-one-signal) and stack headers do not
   carry a real decoration prefix, but when decorations are globally on they
   still need to start at the same content column as decorated lines so the
   view reads as a single tabular column. This rule applies only padding-left,
   NOT the negative text-indent used by .line:has(.line-decoration) — without a
   prefix to fill the indent space the first inline content would otherwise
   render pulled left to ~1.25em, breaking the column. The .stack-header
   selector overrides that element's own padding-left:16px (viewer-styles-content.ts)
   — without it the header juts far left of the message column. */
.line.line-deco-spacer-only,
.stack-header.line-deco-spacer-only {
    padding-left: var(--deco-prefix-width-em, 14.25em);
}
.line:hover { background: var(--vscode-list-hoverBackground); }
/* .stack-gutter-spacer rule retired alongside the inline collapse chevron
   it compensated for. The counter-row chevron now lives on the same column
   on every row (stack-header or regular), so no compensating spacer is needed. */

/* --- Floating copy icon (single overlay pinned to right edge of #log-content) --- */
/* Ghost-paint defense for virtualized row recycle — see
   plans/history/2026.06/2026.06.02/viewer-row-paint-ghosting-attempts.md
   for the full history.

   Symptom: the viewport renderer used to swap visible rows via
   \`viewportEl.innerHTML = …\`. When a slot recycled from one severity (e.g.
   level-info blue) to another (level-database green), Chromium could leave
   un-invalidated pixels of the prior row's text inside the slot's bounding
   box, so faint blue characters ghost through the new green text. The
   user-visible repro is "DRIFT: Drift debug server disconnected" rendered
   with the prior info row's blue text bleeding through; a :hover repaint
   clears it. Four layered defenses sit here, each addressing a different
   point in the paint pipeline:

   1. position: relative + isolation: isolate — gives each row its own
      stacking context so the severity dot's ::before (z-index 2) and the
      chain-stripe ::after (z-index 1) from a *previous* row that overflows
      into this row's space (via overflow: visible) resolve INSIDE the row.
      Without it, an overshooting ::after composed against the global
      stacking context could paint over this row's dot at the overlap.

   2. transform: translateZ(0) — attempt #1 (commit 49297d75). A
      compositor-layer hint promoting each row to its own GPU layer so paint
      invalidation is per-row on row recycle. By itself this turned out to
      be insufficient in production v7.17.0 — the user still saw ghosting on
      the DRIFT disconnect line. Kept here because it is a cheap hint that
      can still help on Chromium versions where the heuristic honors it; it
      composes with (3) and (4) below.

   3. background: var(--vscode-editor-background) — attempt #2 (this
      commit). Each row paints an opaque fill rect before its text content,
      so any stale pixels left behind by Chromium's paint cache are
      physically overwritten by the row's own background. Same color as
      the editor panel parent, so visually invisible, but the fill DOES get
      rasterized, which is the point. This is the most reliable defense
      because it does not depend on browser layer-promotion heuristics.

   4. Atomic DOM swap via <template> + replaceChildren()/appendChild() in
      viewer-data-viewport.ts replaces the innerHTML fast path entirely.
      Forces full disposal of the prior child nodes before fresh nodes
      attach, so the new row has no paint-cache lineage with whatever
      previously occupied that physical slot.

   Bounded cost: virtualization keeps ~50 rows live, so the GPU/compositor
   footprint stays small regardless of how many of these the browser
   actually materializes. The opaque background also does NOT clip the
   severity-gutter ::after stripe overshoot (bottom: -50%) — only
   contain: paint would, which is why we deliberately avoid it. */
.line, .stack-header {
    position: relative;
    isolation: isolate;
    transform: translateZ(0);
    background: var(--vscode-editor-background);
}
#copy-float {
    display: none;
    position: absolute;
    font-size: 14px;
    padding: 2px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editor-background);
    border-radius: 3px;
    user-select: none;
    z-index: 10;
}
#copy-float:hover {
    color: var(--vscode-editor-foreground);
    background: var(--vscode-button-hoverBackground, rgba(90,93,94,0.31));
}
.copy-toast {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
    z-index: 300;
}
.copy-toast.visible { opacity: 1; }

/* --- Clickable source file links within log lines --- */
.source-link {
    /* Was editorLineNumber-foreground (#858585) — that gray is designed to recede
       against the editor gutter, so on the dark viewer background the links were
       effectively invisible and read as non-clickable (user report 2026-07-10).
       Use the theme's link color so a file path looks like the link it is; the
       resting dotted underline marks it actionable without the loud solid link
       underline, which hover then promotes. */
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    cursor: pointer;
    transition: color 0.15s ease;
}
.source-link:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
/* Per-segment hover highlight while Ctrl/Cmd is held.
   :has(~ .source-link-seg:hover) matches any segment that has a LATER
   sibling being hovered — combined with :hover on the hovered segment
   itself, this lights up the cumulative prefix the click would filter on.
   Without the body.ctrl-held gate the segments would highlight on plain
   hover too, defeating the visual cue that Ctrl unlocks a different
   action (filter) than plain click (open file). */
body.ctrl-held .source-link-seg:hover,
body.ctrl-held .source-link-seg:has(~ .source-link-seg:hover) {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
body.ctrl-held .source-link {
    cursor: cell;
}

/* Whole stack-FRAME rows open their source on a click anywhere on the row
   (viewer-script-click-handlers.ts). The member name is the obvious target but
   renders as bright plain text, so the row read as non-clickable while the only
   cue — the floated path link — clipped off-screen in a narrow sidebar (user
   report 2026-06-16). :has(.source-link) scopes the cursor to frames that
   actually carry a link, so link-less dart-SDK frames keep the default cursor
   and avoid a dead-click affordance. */
.stack-line:has(.source-link) { cursor: pointer; }
/* Persistent subtle dotted underline marks the member as actionable without
   washing the whole trace in link color; the row hover promotes it to a solid
   themed-link underline + color, matching the .source-link hover treatment. */
.frame-member {
    text-decoration: underline dotted var(--vscode-descriptionForeground);
    text-underline-offset: 2px;
}
.stack-line:has(.source-link):hover .frame-member {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline solid var(--vscode-textLink-foreground, #3794ff);
}

/* --- Clickable URL links within log lines --- */
.url-link {
    color: var(--vscode-editorLineNumber-foreground, #858585);
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.15s ease;
}
.url-link:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
}

/* --- Focus indicators for keyboard navigation --- */
button:focus-visible, .ib-icon:focus-visible, input:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -1px;
}

/* --- stderr output lines (DAP category "stderr") --- */
.line.cat-stderr {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}

/* --- Log level styling (error/warning/performance/info) --- */
.line.level-error {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}
/* Softer than primary fault lines; dashed edge matches severity bar "recent context" tone.
   Uses outline-style trick: inset box-shadow avoids shifting content (no padding override). */
.line.recent-error-context {
    box-shadow: inset 2px 0 0 color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 50%, var(--vscode-panel-border, #555));
}
.line.level-error.recent-error-context {
    color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 72%, var(--vscode-editor-foreground, #d4d4d4));
}
.line.level-warning {
    color: var(--vscode-debugConsole-warningForeground, #cca700);
}
/* Performance: purple bar + text (--vscode-charts-purple) matches level-bar-performance. */
.line.level-performance {
    color: var(--vscode-charts-purple, #a855f7);
}
/* Info: blue — same token as Notice/Framework chart blue. Why we moved off
   debugConsole-infoForeground: that token resolves to a purple-ish tint in
   several themes (and the fallback is #b695f8 purple), which clashed with
   Performance (also purple). Anchoring Info to charts-blue keeps the
   "standard info blue" reading users expect and frees the cyan/green
   space for Notice and Database below. */
.line.level-info {
    color: var(--vscode-charts-blue, #2196f3);
}
.line.level-todo {
    color: var(--vscode-terminal-ansiWhite, #e5e5e5);
    opacity: 0.9;
}
.line.level-debug {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
}
/* Notice: cyan — distinct from Info (blue) and Database (green). Notice is a
   step above Info but below Warning, so a cooler hue between blue and green
   reads as "pay attention but not urgent". */
.line.level-notice {
    color: var(--vscode-terminal-ansiCyan, #00bcd4);
}
/* Database: green — distinct from Notice (cyan). Green reads as "neutral
   activity, healthy traffic" which fits SQL query output (it is not an
   error or warning, just a record of what the DB did). */
.line.level-database {
    color: var(--vscode-charts-green, #4caf50);
}

/* --- ASCII separator lines (===, ---, +---, Drift/Unicode box banners, etc.) --- */
.line.separator-line {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
    word-break: normal;
    overflow-wrap: normal;
    /* One row per captured log line; scroll #log-content horizontally if the banner is wider than the pane. */
    white-space: pre;
}

/* --- No-wrap mode: horizontal scroll instead of wrapping --- */
#log-content.nowrap {
    overflow-x: auto;
}
#log-content.nowrap .line,
#log-content.nowrap .stack-header,
#log-content.nowrap .stack-frames .line {
    white-space: pre;
    word-break: normal;
}
`;
}
