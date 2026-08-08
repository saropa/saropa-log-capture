/**
 * Styles for screenshots in the flow-map panel: the thumbnails drawn on diagram cards and the
 * full-size lightbox. Split from `flow-map-panel-styles.ts` to keep that file inside the line budget;
 * `flowMapStyles()` concatenates this chunk into the same nonce-guarded `<style>` block.
 */

/** CSS text (no `<style>` wrapper) for diagram thumbnails and the screenshot lightbox. */
export function flowMapShotStyles(): string {
    return `
  /* Diagram card thumbnails: an HTML <img> inside a <foreignObject> (see thumbMarkup for why not an
     SVG <image>), filling its frame and cropped from the BOTTOM — object-position:top is what keeps a
     phone capture's identifying chrome, and is this element's equivalent of xMidYMin slice. */
  .fm-shot { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; cursor: pointer; }
  .fm-shot:hover { filter: brightness(1.12); }
  /* A thumbnail is its own tab stop, so it needs its own visible focus ring — brightness alone is not
     a focus indicator (WCAG 2.4.7). Keep the default outline rather than suppressing it. */
  .fm-shot:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
  /* A capture whose file could not be fetched (see the lightbox script's error handler). The alt text
     is what the frame shows instead, so the reader learns WHICH screen is missing rather than reading
     a browser broken-image glyph — and the cursor stops advertising a click that would open nothing. */
  .fm-shot-missing { cursor: default; font-size: 0.75rem; color: var(--muted); background: var(--surface-2); padding: 0.3rem; }
  .fm-shot-frame { stroke: var(--border); pointer-events: none; }
  /* :focus-within, not :focus — Tab lands on the child <image>, never on the .fm-node group itself,
     so a :focus rule on the group would never fire once thumbnails became focusable. */
  .fm-node:hover .fm-shot-frame, .fm-node:focus-within .fm-shot-frame { stroke: var(--vscode-focusBorder); }
  /* Multi-capture pill sits ON the thumbnail, so it needs its own opaque backing rather than the
     card fill — over a photo, a translucent chip is unreadable. */
  .fm-shot-pill { fill: var(--surface-1); stroke: var(--border); stroke-width: 1; }
  /* Halo the digit against the pill rather than trusting the pill's fill: the tinted variants below
     mix a severity color into the backing, and paint-order:stroke keeps the count legible whatever
     that mix lands on (and over the capture itself, if a pill ever sits proud of its rect). */
  .fm-shot-pill-text { fill: var(--text); stroke: var(--surface-1); stroke-width: 2; paint-order: stroke; stroke-linejoin: round; }
  /* Severity tint: the capture on show is the fault one, not merely the first of N. Tinted at the
     same ratio the diagram's crash/warning node fills use, so the pill reads as part of the existing
     severity language and the count digit keeps its --text contrast in both themes. */
  .fm-shot-pill-alert { fill: color-mix(in srgb, var(--status-bad) 22%, var(--surface-1)); stroke: var(--status-bad); }
  .fm-shot-pill-warn { fill: color-mix(in srgb, var(--accent-warning) 22%, var(--surface-1)); stroke: var(--accent-warning); }

  /* Screenshot lightbox: centered card over a dimmed backdrop, sized to the viewport so the capture
     shows at the largest size that still leaves its facts visible. */
  .fms-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 1.2rem; background: rgba(0,0,0,0.62); }
  /* --shot-fit-h is the ONE definition of how tall a fitted capture may be. The stage's cap and the
     image's cap must be equal — a stage shorter than the image scrolls in fit mode (which fit mode
     exists to avoid), and a stage taller than the image leaves dead space the zoomed picture then
     jumps into. Two literals could not be kept equal by anything; one token is equal by construction. */
  .fms-card { --shot-fit-h: 70vh; position: relative; display: flex; flex-direction: column; gap: 0.6rem; max-width: min(92vw, 900px); max-height: 92vh; overflow: auto; padding: 1.1rem 1.3rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
  /* The capture's scroll box. min-height:0 lets it shrink inside the flex column instead of pushing
     the facts grid out of the card.
     max-height is what makes this box ACTUALLY scroll: without a height cap the stage just grows
     with the zoomed image and the CARD scrolls instead, so the zoom script's scrollLeft/scrollTop
     anchoring wrote to a container that could not scroll — the image appeared to jump on every
     wheel tick.
     display:block, NOT flex: justify-content:center on a scroll container makes the overflowing
     leading edge unreachable (scrollLeft cannot go below 0), so the left of a zoomed capture was
     permanently clipped. Block layout plus margin:auto on the image centers it in fit mode and
     leaves the whole picture reachable once it overflows. */
  .fms-stage { min-height: 0; max-height: var(--shot-fit-h); overflow: auto; display: block; }
  /* max-width/max-height are the FIT mode; the zoom script pins an explicit width inline when zoomed
     and CLEARS its inline values to return here, so this stays the single definition of "fit". */
  .fms-img { display: block; margin: 0 auto; max-width: 100%; max-height: var(--shot-fit-h); object-fit: contain; border: 1px solid var(--border); border-radius: var(--radius); background: rgba(0,0,0,0.25); }
  /* Zoom strip under the capture: reset-to-fit, slider, live percentage. */
  .fms-zoombar { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85em; }
  .fms-zoom-range { flex: 1 1 auto; min-width: 6rem; accent-color: var(--link); cursor: pointer; }
  .fms-zoom-pct { min-width: 3.2rem; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
  .fms-zoom-fit { border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 4px; cursor: pointer; padding: 0.1rem 0.4rem; }
  .fms-zoom-fit:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); }
  /* Compare view: two captures of the same screen, side by side, sharing a height so the screens
     line up row for row — an unaligned pair makes every element look changed. Replaces the single
     stage rather than sitting beside it (see the toggle in flow-map-panel-lightbox-compare.ts). */
  /* Local hide utility. The viewer's u-hidden is not in this panel's stylesheet, and borrowing that
     name here would create a second definition of a shared utility that nothing keeps in step. */
  .fms-off { display: none !important; }
  .fms-cmp { display: flex; gap: 0.6rem; min-height: 0; overflow: auto; justify-content: center; }
  .fms-cmp-pane { display: flex; flex-direction: column; gap: 0.3rem; align-items: center; min-width: 0; }
  .fms-cmp-img { display: block; max-width: 100%; max-height: 62vh; object-fit: contain; border: 1px solid var(--border); border-radius: var(--radius); background: rgba(0,0,0,0.25); }
  .fms-cmp-cap { font-size: 0.82em; color: var(--muted); }
  .fms-cmp-bar { display: flex; align-items: center; gap: 0.4rem; }
  .fms-cmp-btn { border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 4px; cursor: pointer; padding: 0.1rem 0.5rem; font-size: 0.85em; }
  .fms-cmp-btn:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); }
  .fms-cmp-btn.fms-cmp-on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  /* Filename row: the name reads inline, the full path rides on the copy button and the hover title —
     an absolute Windows path inline would dominate a facts grid it is the least-read row of. */
  .fms-path { display: flex; align-items: center; gap: 0.4rem; }
  .fms-file { font-family: var(--vscode-editor-font-family); word-break: break-all; }
  .fms-copy { flex: 0 0 auto; border: 1px solid var(--border); background: transparent; color: var(--muted); border-radius: 4px; cursor: pointer; padding: 0 0.35rem; line-height: 1.4; }
  .fms-copy:hover { color: var(--text); background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); }
  .fms-close { position: absolute; top: 0.5rem; right: 0.5rem; border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 1rem; padding: 0.15rem 0.4rem; border-radius: 5px; }
  .fms-close:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); color: var(--text); }
  .fms-count { font-size: 0.85em; color: var(--muted); text-align: center; }
  /* Prev · position · next. The counter keeps flex:1 so the two arrows stay pinned to the card's
     edges however long the localized "Capture 3 of 7 on this screen" runs. */
  .fms-nav { display: flex; align-items: center; gap: 0.5rem; }
  .fms-nav .fms-count { flex: 1 1 auto; }
  .fms-nav-btn { flex: 0 0 auto; border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 4px; cursor: pointer; padding: 0 0.55rem; font-size: 1.05em; line-height: 1.5; }
  .fms-nav-btn:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); }
  /* Kept visible (not hidden) at the ends of the set: an arrow that disappears reads as a layout
     glitch, while a dimmed one says "this is the first capture". */
  .fms-nav-btn:disabled { opacity: 0.35; cursor: default; }
  /* Inline capture thumbnails on timeline points and dwell rows. Deliberately small — they are a
     "there is a picture of this moment" cue, and the lightbox is where the picture gets looked at. */
  .fm-mini-shot { display: block; object-fit: cover; object-position: top center; border: 1px solid var(--border); border-radius: 3px; cursor: pointer; background: var(--surface-2); }
  .fm-mini-shot:hover { filter: brightness(1.15); border-color: var(--vscode-focusBorder); }
  .fm-mini-shot:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
  /* Dwell table: a fixed-width cell so the screen names below it still align down the column. */
  td.shot-cell { width: 34px; padding-right: 0.3rem; }
  td.shot-cell .fm-mini-shot { width: 28px; height: 34px; }
  /* Timeline thumbnails ride INSIDE the chart SVG (a <foreignObject> under the x axis, positioned at
     their own bin's x) rather than in an HTML strip beneath it. A capture belongs to a MOMENT, and
     only sharing the chart's coordinate system keeps each thumbnail under its own point at every
     column width — an HTML strip would have to re-derive the mapping and drift from it. */
  .fm-mini-shot.ac-shot { width: 100%; height: 100%; }
  .fms-grid { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 0.9rem; font-size: 0.92em; }
  .fms-k { color: var(--muted); }
  .fms-v { word-break: break-word; }
  .fms-link { color: var(--link); cursor: pointer; font-family: var(--vscode-editor-font-family); }
  .fms-link:hover { text-decoration: underline; color: var(--vscode-textLink-activeForeground); }`;
}
