/**
 * CSS for ASCII art block grouping: shimmer, padding, continuous gutter, gap suppression.
 *
 * Art blocks are consecutive separator lines sharing the same timestamp, tagged by
 * `finalizeArtBlock()` with `artBlockPos` = 'start' | 'middle' | 'end'. The first line
 * keeps its decoration; continuation lines show only art content. The gutter uses a solid
 * `border-left` (not bar-up/bar-down `::after` pseudo — that is reserved for the shimmer).
 */
export function getAsciiArtStyles(): string {
    return /* css */ `
/* --- ASCII Art Block: grouped separator lines rendered as one visual unit --- */

/* All art-block lines: uniform color, tight layout, no wrapping.
   line-height 1 + height 1em collapses the inter-row gap so vertical box-drawing
   strokes (│, ║) on adjacent rows connect cleanly. The base .line rule uses
   line-height 1.5 which left visible whitespace above and below every glyph —
   fine for prose, but it shreds ASCII banners. */
.line.art-block-start,
.line.art-block-middle,
.line.art-block-end {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 1;
    white-space: pre;
    word-break: normal;
    overflow-wrap: normal;
    position: relative;
    overflow: hidden;
    line-height: 1;
    height: 1em;
}

/* Top of block: rounded top corners, padded breathing room above.
   Breathing room uses padding (not margin) so it is included in the element's
   height and stays in sync with calcItemHeight — margins would desync the
   virtual scroller's prefix sums and cause rows below the block to drift. */
.line.art-block-start {
    padding-top: 6px;
    height: calc(1em + 6px);
    border-radius: 6px 6px 0 0;
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 4%, transparent);
}

/* Middle lines: zero vertical gap, shared background, no decoration */
.line.art-block-middle {
    padding-left: var(--deco-prefix-width-em, 14.25em);
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 4%, transparent);
}

/* Bottom of block: rounded bottom corners, padded breathing room below
   (see note on .art-block-start for why this is padding, not margin). */
.line.art-block-end {
    padding-bottom: 6px;
    height: calc(1em + 6px);
    border-radius: 0 0 6px 6px;
    padding-left: var(--deco-prefix-width-em, 14.25em);
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 4%, transparent);
}

/* Pin the start-line decoration to a fixed slot so the box-drawing art always
   begins at exactly --deco-prefix-width-em from the left, regardless of
   timestamp/counter/PID text length. Without this, a wider decoration (e.g.
   5-digit line numbers + logcat tag + PID/TID) pushes the first row's '╭'
   rightward while the '│' on middle rows stays pinned to padding-left — the
   user sees corners that don't align with the vertical bars below them.
   WHY the /0.85 divisor: .line-decoration has font-size: 0.85em, so inside it
   1em = 0.85em-of-parent. To reserve exactly --deco-content-indent-em of the
   PARENT em, we need that many em / 0.85 in the decoration's own em unit. */
.line.art-block-start .line-decoration {
    display: inline-block;
    width: calc(var(--deco-content-indent-em, 13em) / 0.85);
    overflow: hidden;
    vertical-align: top;
}

/* Continuous gutter bar via border-left (avoids ::after conflict with shimmer).
   Uses --bar-color set by the level-bar-* class (always info for separator lines). */
.line.art-block-start[class*="level-bar-"],
.line.art-block-middle[class*="level-bar-"],
.line.art-block-end[class*="level-bar-"] {
    border-left: 0.23em solid var(--bar-color);
    margin-left: 0.74em;
}

/* Suppress severity dot on continuation lines (start keeps its dot) */
.line.art-block-middle[class*="level-bar-"]::before,
.line.art-block-end[class*="level-bar-"]::before {
    display: none;
}

/* Shimmer sweep across the art block */
.line.art-block-start::after,
.line.art-block-middle::after,
.line.art-block-end::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
        105deg,
        transparent 0%,
        transparent 35%,
        color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 6%, transparent) 45%,
        color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 10%, transparent) 50%,
        color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 6%, transparent) 55%,
        transparent 65%,
        transparent 100%
    );
    background-size: 300% 100%;
    animation: art-block-shimmer 4s ease-in-out infinite;
}

/* Stagger shimmer across rows for a cascading wave effect */
.line.art-block-middle::after { animation-delay: 0.12s; }
.line.art-block-end::after { animation-delay: 0.24s; }

@keyframes art-block-shimmer {
    0% { background-position: 300% 0; }
    100% { background-position: -300% 0; }
}

/* Hover: brighten the whole block together via increased tint */
.line.art-block-start:hover,
.line.art-block-middle:hover,
.line.art-block-end:hover {
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 8%, transparent);
}
`;
}
