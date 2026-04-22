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
.line.line-tint-notice {
    background-color: rgba(33, 150, 243, 0.08);
}
.line.line-tint-notice:hover {
    background-color: rgba(33, 150, 243, 0.16);
}
.line.line-tint-database {
    background-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #00bcd4) 12%, transparent);
}
.line.line-tint-database:hover {
    background-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #00bcd4) 20%, transparent);
}
/* Matches .line.level-info / .level-bar-info (debug console info token). */
.line.line-tint-info {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-infoForeground, #b695f8) 10%, transparent);
}
.line.line-tint-info:hover {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-infoForeground, #b695f8) 18%, transparent);
}

/* Blank/empty lines: set --blank-line-bg to any color to join before/after; when unset, previous line tint shows. */
.line.line-blank {
    background-color: var(--blank-line-bg);
}

/* Positioning context for severity dots and connector bars */
#viewport { position: relative; }

/* Severity dot mode (colored circle on timeline) — scale with zoom via em */
[class*="level-bar-"] { z-index: 1; }
[class*="level-bar-"]::before {
    content: ''; position: absolute; left: 0.69em;
    top: 0; bottom: 0; margin: auto 0;
    width: 0.54em; height: 0.54em; border-radius: 50%;
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
.level-bar-notice { --bar-color: var(--vscode-charts-blue, #2196f3); }
.level-bar-framework { --bar-color: var(--vscode-charts-blue, #2196f3); }
.level-bar-database { --bar-color: var(--vscode-terminal-ansiCyan, #00bcd4); }
.level-bar-info { --bar-color: var(--vscode-debugConsole-infoForeground, #b695f8); }
[class*="level-bar-"]::before { background: var(--bar-color); }
.bar-bridge::before { display: none; }
/* Blank lines: no dot, keep vertical bar (connector) */
.line-blank[class*="level-bar-"]::before { display: none; }

/* Connector bars join consecutive dots — scale with zoom via em */
.bar-down::after, .bar-up::after {
    content: ''; position: absolute; left: 0.85em; width: 0.23em;
    background: var(--bar-color); opacity: 0.45; pointer-events: none; z-index: 1;
}
.bar-down:not(.bar-up)::after { top: 50%; bottom: 0; }
.bar-up:not(.bar-down)::after { top: 0; bottom: 50%; }
.bar-up.bar-down::after { top: 0; bottom: 0; }

/* Hidden-lines chevron: zero-height indicator between visible lines when non-blank lines are filtered out.
   The div is zero-height; the absolute span overflows visually without affecting layout.
   WHY centered in the severity-dot column: the severity bar at left:0.69em + width:0.54em
   forms a vertical timeline of dots. A gap in that timeline *is* the signal that lines
   were hidden; placing the ellipsis at the dot's center (0.96em) visually fills the gap
   instead of squeezing a tiny glyph into the 0.69em sliver to the left of the dots,
   which reads as a single pixel against the dot column. */
.hidden-chevron {
    position: relative;
    height: 0;
    overflow: visible;
    /* WHY unselectable: this glyph is a UI indicator for hidden rows, not log content.
       Without this, drag-selecting across a gap pulls the glyph into the clipboard
       (user reported copied text full of stray \\u25B8/\\u22EE characters). */
    user-select: none;
    -webkit-user-select: none;
}
.hidden-chevron > span { user-select: none; -webkit-user-select: none; }
.hidden-chevron > span {
    position: absolute;
    /* 0.96em = dot column center (0.69em + 0.54em/2); translateX(-50%) centers the glyph on it.
       translateY(-50%) centers vertically on the div's baseline (which sits between the two
       flanking .line rows since the parent is height:0) so the big glyph straddles the gap. */
    left: 0.96em;
    top: 0;
    transform: translate(-50%, -50%);
    /* Icon represents hidden *rows*, not just a hint — scale to roughly a row's worth so the
       gap is obvious without crowding the flanking dots. */
    font-size: 2em;
    line-height: 1;
    color: var(--vscode-descriptionForeground, #bbb);
    opacity: 0.95;
    cursor: help;
    z-index: 3;
    font-weight: 700;
    letter-spacing: -0.1em;
    /* Background mask hides the faint connector bar (bar-down/up at left:0.85em, width:0.23em)
       passing through this gap when both flanking dots share a level — otherwise the connector
       threads through the ellipsis and muddies the "gap here" signal. Padding widens the mask
       slightly beyond the glyph so the connector is fully occluded at the crossover. */
    padding: 0 0.12em;
    background: var(--vscode-editor-background, #1e1e1e);
    border-radius: 0.15em;
}
/* WHY ::before content instead of a text node inside the span:
   a DOM text node can be pulled into window.getSelection() by native drag-select,
   so Ctrl/Cmd+C was pasting the glyph between log lines. CSS ::before content is
   not part of the DOM and is excluded from every copy path (native selection,
   Select All, execCommand, clipboard API). The title attribute on the span still
   works for the tooltip. U+22EE VERTICAL ELLIPSIS reads as "more dots here"
   inside the severity-dot timeline. */
.hidden-chevron > span::before { content: '\\22EE'; }
/* Click target — the 2em glyph sits in a zero-height div, so pointer-events need to
   extend past the zero rect. The span is already visually ~32px tall; make it
   pointer-interactive and give the parent div a tall hit zone without adding layout. */
.hidden-chevron { cursor: pointer; pointer-events: auto; }
.hidden-chevron > span { pointer-events: auto; }
.hidden-chevron:hover > span { opacity: 1; color: var(--vscode-textLink-foreground, #3794ff); }

/* Un-peek marker: rendered at the start of every contiguous run of peekOverride'd
   items by the render loop in viewer-data-viewport.ts. Same column and zero-height
   approach as .hidden-chevron so layout is unaffected; different glyph (U+2212
   MINUS SIGN) and accent color so users can visually tell the two states apart. */
.peek-collapse {
    position: relative;
    height: 0;
    overflow: visible;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
}
.peek-collapse > span {
    position: absolute;
    left: 0.96em;
    top: 0;
    transform: translate(-50%, -50%);
    font-size: 2em;
    line-height: 1;
    color: var(--vscode-textLink-foreground, #3794ff);
    opacity: 0.95;
    z-index: 3;
    font-weight: 700;
    letter-spacing: -0.1em;
    padding: 0 0.12em;
    background: var(--vscode-editor-background, #1e1e1e);
    border-radius: 0.15em;
    user-select: none;
    -webkit-user-select: none;
}
.peek-collapse > span::before { content: '\\2212'; }
.peek-collapse:hover > span { opacity: 1; color: var(--vscode-errorForeground, #f48771); }

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

/* Error classification badges */
.error-badge {
    display: inline-block;
    padding: 1px 6px;
    margin-right: 4px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    vertical-align: middle;
}

.error-badge-critical {
    background-color: rgba(255, 0, 0, 0.2);
    color: var(--vscode-errorForeground, #f48771);
    border: 1px solid var(--vscode-errorForeground, #f48771);
}

.error-badge-transient {
    background-color: rgba(255, 165, 0, 0.15);
    color: var(--vscode-debugConsole-warningForeground, #cca700);
    border: 1px solid var(--vscode-debugConsole-warningForeground, #cca700);
}

.error-badge-bug {
    background-color: rgba(255, 105, 180, 0.15);
    color: var(--vscode-debugConsole-errorForeground, #f48771);
    border: 1px solid var(--vscode-debugConsole-errorForeground, #f48771);
}

.error-badge-anr {
    background-color: rgba(255, 152, 0, 0.2);
    color: var(--vscode-debugConsole-warningForeground, #ff9800);
    border: 1px solid rgba(255, 152, 0, 0.3);
}

/* Critical fire icon — replaces the severity dot in the gutter. */
/* WHY absolute: must sit over the gutter at the same spot as the */
/* [class*="level-bar-"]::before dot (left: 0.69em) without pushing the */
/* log text. .line has position: relative so this anchors inside the row. */
.critical-fire-icon {
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
/* Hide the severity dot on lines that already carry the fire icon, so */
/* the emoji alone acts as the severity indicator — no duplication. */
.line:has(.critical-fire-icon)[class*="level-bar-"]::before { display: none; }
`;
}
