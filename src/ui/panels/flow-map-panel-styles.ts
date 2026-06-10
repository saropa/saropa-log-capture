/**
 * Styles for the flow-map webview panel (extracted to keep flow-map-panel.ts under the line limit).
 * Theme-aware via VS Code CSS variables. Tables use row separators only (no grid), the stat counters
 * are pills in a sticky top bar, and sections are collapsible <details>.
 */

/** The full `<style>` block for the panel, nonce-guarded for CSP. */
export function flowMapStyles(nonce: string): string {
    return `<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); font-size: 13.5px; color: var(--vscode-foreground); padding: 0 1.5rem 2.5rem; line-height: 1.55; }
  h1 { font-size: 1.5em; margin: 0.4rem 0 0.25rem; }
  .report-title { margin: 0.6rem 0 0.5rem; }
  h3 { font-size: 1.02em; margin: 0 0 0.4rem; }
  .legend { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin: 0.2rem 0 0.5rem; }

  .topbar { position: sticky; top: 0; z-index: 6; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.55rem 0; margin-bottom: 0.4rem; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-panel-border); }
  .pills { display: flex; flex-wrap: wrap; gap: 0.4rem; flex: 1 1 auto; }
  .pill { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.65rem; border-radius: 999px; font-size: 0.85em; background: rgba(127,127,127,0.12); border: 1px solid transparent; white-space: nowrap; }
  .pill b { font-variant-numeric: tabular-nums; }
  .pill-link { cursor: pointer; }
  .pill-link:hover { filter: brightness(1.2); }
  .pill-green { background: rgba(63,185,80,0.16); border-color: rgba(63,185,80,0.4); }
  .pill-blue { background: rgba(88,166,255,0.16); border-color: rgba(88,166,255,0.4); }
  .pill-amber { background: rgba(210,153,34,0.16); border-color: rgba(210,153,34,0.4); }
  .pill-purple { background: rgba(163,113,247,0.16); border-color: rgba(163,113,247,0.4); }
  .pill-red { background: rgba(224,82,82,0.2); border-color: rgba(224,82,82,0.45); }
  .topbar-actions { flex: 0 0 auto; display: flex; gap: 0.4rem; }
  .icon-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 7px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
  .icon-btn:hover { background: var(--vscode-button-hoverBackground); }

  .report-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
  /* TOC entries are navigation — styled like the (info) stat chips but never underlined, so the two
     reads as distinct surfaces (nav chips vs info pills). */
  .toc { display: flex; flex-wrap: wrap; gap: 0.4rem 0.5rem; margin: 0.4rem 0 1rem; font-size: 0.88em; }
  .toc a { color: var(--vscode-foreground); text-decoration: none; padding: 0.18rem 0.75rem; border-radius: 999px; background: rgba(127,127,127,0.12); border: 1px solid transparent; }
  .toc a:hover, .toc a:focus-visible { background: rgba(127,127,127,0.22); border-color: var(--vscode-focusBorder); outline: none; }

  .logpath { color: var(--vscode-textLink-foreground); font-family: var(--vscode-editor-font-family); font-size: 0.85em; cursor: pointer; margin: 0 0 0.7rem; word-break: break-all; }
  .logpath:hover { text-decoration: underline; color: var(--vscode-textLink-activeForeground); }

  .session-info { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.9rem; font-size: 0.92em; }
  .si-k { color: var(--vscode-descriptionForeground); }

  .sec { margin: 1.1rem 0; }
  /* No always-on marker on the left; a chevron fades in on the right only when the header is hovered. */
  .sec > summary { position: relative; font-size: 1.16em; font-weight: 600; cursor: pointer; padding: 0.3rem 1.5rem 0.3rem 0.55rem; border-left: 3px solid var(--vscode-textLink-foreground); list-style: none; user-select: none; }
  .sec > summary::-webkit-details-marker { display: none; }
  .sec > summary::after { content: '▾'; position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%); font-size: 0.8em; color: var(--vscode-descriptionForeground); opacity: 0; transition: opacity 0.12s; }
  .sec > summary:hover::after, .sec > summary:focus-visible::after { opacity: 0.8; }
  .sec:not([open]) > summary::after { content: '▸'; }
  .sec-body { padding: 0.5rem 0 0.2rem; }

  /* Diagram on the left; narrative + tables stacked in the right column so they stay visible
     alongside a tall diagram instead of being pushed below it. Wraps to one column when narrow.
     The gap is 0 here because the .col-resize divider supplies the visual gutter (and the drag
     target); a flex gap would otherwise double the space and split the hit area. */
  .report-row { display: flex; flex-wrap: wrap; gap: 0; align-items: flex-start; }
  /* Width is driven by --diagram-w (set by the resize drag); auto until the user drags. */
  .diagram-col { flex: 0 0 auto; width: var(--diagram-w, auto); min-width: 260px; max-width: 100%; }
  .detail-col { flex: 1 1 420px; min-width: 320px; }
  .detail-col p { max-width: 60ch; }
  .diagram { overflow-x: auto; max-width: 100%; padding: 0.4rem 0 1rem; }

  /* Draggable column divider. A wide invisible hit area around a thin visible rule keeps the grab
     forgiving without a fat gutter. Highlights on hover/drag so the affordance is discoverable. */
  .col-resize { flex: 0 0 auto; align-self: stretch; width: 1.75rem; cursor: col-resize; position: relative; touch-action: none; }
  .col-resize::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-50%); background: var(--vscode-panel-border); transition: background 0.12s; }
  .col-resize:hover::before, .col-resize.dragging::before { background: var(--vscode-focusBorder); width: 3px; }

  /* When every section in a column is collapsed, the column shrinks to its headers so the open
     column claims the freed width — symmetric for the single-section flow side and the detail side. */
  .diagram-col.col-collapsed { width: auto; min-width: 0; }
  .detail-col.col-collapsed { flex: 0 0 auto; min-width: 0; }
  /* A fully-collapsed column has no content to resize against — hide the divider so it can't strand. */
  .report-row.no-resize .col-resize { pointer-events: none; }
  .report-row.no-resize .col-resize::before { opacity: 0.4; }
  /* Single-column (wrapped) layout: the divider is meaningless, so it folds away. */
  @media (max-width: 720px) { .col-resize { display: none; } .diagram-col { width: auto; } }

  /* Sortable headers (Issue Report): a chevron fades in on hover; the active sort key shows its
     direction persistently. Cursor + user-select make the click target read as interactive. */
  table.sortable th { cursor: pointer; user-select: none; }
  table.sortable th::after { content: '↕'; margin-left: 0.35rem; opacity: 0; font-size: 0.85em; }
  table.sortable th:hover::after { opacity: 0.55; }
  table.sortable th[aria-sort="ascending"]::after { content: '▲'; opacity: 0.9; }
  table.sortable th[aria-sort="descending"]::after { content: '▼'; opacity: 0.9; }

  /* Executive-summary copy button: parked top-right of the block, invisible until the block is
     hovered or the button itself is focused (keyboard reachability). */
  .narrative-block { position: relative; }
  .copy-narrative { position: absolute; top: 0; right: 0; border: none; background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 1.05em; padding: 0.1rem 0.3rem; border-radius: 5px; opacity: 0; transition: opacity 0.12s; }
  .narrative-block:hover .copy-narrative, .copy-narrative:focus-visible { opacity: 0.85; }
  .copy-narrative:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); opacity: 1; }

  table { border-collapse: collapse; width: auto; max-width: 100%; font-size: 0.95em; margin-top: 0.4rem; }
  th, td { padding: 0.45rem 0.95rem; text-align: left; vertical-align: top; }
  th { font-weight: 600; white-space: nowrap; color: var(--vscode-descriptionForeground); border-bottom: 2px solid var(--vscode-panel-border); text-transform: uppercase; font-size: 0.82em; letter-spacing: 0.03em; }
  td { border-bottom: 1px solid var(--vscode-panel-border); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--vscode-list-hoverBackground); }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.ctr, th.ctr { text-align: center; }
  td.nowrap { white-space: nowrap; }

  .src { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; font-family: var(--vscode-editor-font-family); white-space: nowrap; }
  .src:hover { text-decoration: underline; color: var(--vscode-textLink-activeForeground); }
  .src-empty { color: var(--vscode-descriptionForeground); text-align: center; }
  .logcell { white-space: nowrap; }
  .loglink { color: var(--vscode-textLink-foreground); cursor: pointer; font-family: var(--vscode-editor-font-family); }
  .loglink:hover { text-decoration: underline; }
  .logcopy { cursor: pointer; margin-left: 0.45rem; opacity: 0.55; }
  .logcopy:hover { opacity: 1; }

  /* Activity line chart: scales to the detail column width; theme-aware strokes/fills. */
  .activity-wrap { max-width: 680px; padding: 0.3rem 0 0.4rem; }
  .activity-chart { width: 100%; height: auto; }
  .ac-empty { color: var(--vscode-descriptionForeground); font-size: 0.92em; }
  .ac-axis { stroke: var(--vscode-panel-border); stroke-width: 1; }
  .ac-grid { stroke: var(--vscode-panel-border); stroke-width: 1; opacity: 0.4; }
  .ac-num, .ac-clock { fill: var(--vscode-descriptionForeground); font-size: 11px; font-variant-numeric: tabular-nums; font-family: var(--vscode-font-family); }
  .ac-line { fill: none; stroke: var(--vscode-charts-blue, #58a6ff); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .ac-pt { fill: var(--vscode-charts-blue, #58a6ff); }
  .ac-link { cursor: pointer; }
  .ac-link:hover, .ac-link:focus { fill: var(--vscode-charts-orange, #d29922); r: 5.5; outline: none; }

  .dwell { min-width: 110px; }
  .dwell-bar { display: inline-block; height: 0.62em; border-radius: 3px; background: linear-gradient(90deg, #2ea043, #58a6ff); vertical-align: middle; margin-right: 0.45rem; }
  .dwell-text { font-variant-numeric: tabular-nums; }

  .fm-node { cursor: pointer; }
  .fm-node rect { transition: stroke-width 0.12s ease, filter 0.12s ease; }
  .fm-node:hover rect, .fm-node:focus rect { stroke-width: 3; filter: brightness(1.18); outline: none; }
  .fm-crash rect { animation: fm-pulse 1.7s ease-in-out infinite; }
  .diagram svg { animation: fm-fade 0.45s ease both; }
  tr.fm-hl { background: var(--vscode-list-activeSelectionBackground) !important; box-shadow: inset 3px 0 0 var(--vscode-focusBorder); }
  tr.sev-error td:first-child { box-shadow: inset 3px 0 0 #e05252; }
  tr.sev-warn td:first-child { box-shadow: inset 3px 0 0 #d29922; }
  tr.sev-perf td:first-child { box-shadow: inset 3px 0 0 #3fb950; }
  @keyframes fm-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes fm-pulse { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.3; } }
  @media (prefers-reduced-motion: reduce) { .diagram svg, .fm-crash rect { animation: none; } }
</style>`;
}
