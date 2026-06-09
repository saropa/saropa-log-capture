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
  h3 { font-size: 1.02em; margin: 0 0 0.4rem; }
  .facts { color: var(--vscode-descriptionForeground); font-size: 0.92em; margin: 0 0 0.6rem; }
  .facts strong { color: var(--vscode-foreground); }
  .legend { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin: 0.2rem 0 0.5rem; }

  .topbar { position: sticky; top: 0; z-index: 6; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.55rem 0; margin-bottom: 0.4rem; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-panel-border); }
  .pills { display: flex; flex-wrap: wrap; gap: 0.4rem; flex: 1 1 auto; }
  .pill { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.65rem; border-radius: 999px; font-size: 0.85em; background: rgba(127,127,127,0.12); border: 1px solid transparent; white-space: nowrap; }
  .pill b { font-variant-numeric: tabular-nums; }
  .pill-link { cursor: pointer; }
  .pill-link:hover { filter: brightness(1.2); }
  .facts-link { cursor: pointer; }
  .facts-link:hover { color: var(--vscode-foreground); text-decoration: underline; }
  .pill-green { background: rgba(63,185,80,0.16); border-color: rgba(63,185,80,0.4); }
  .pill-blue { background: rgba(88,166,255,0.16); border-color: rgba(88,166,255,0.4); }
  .pill-amber { background: rgba(210,153,34,0.16); border-color: rgba(210,153,34,0.4); }
  .pill-purple { background: rgba(163,113,247,0.16); border-color: rgba(163,113,247,0.4); }
  .pill-red { background: rgba(224,82,82,0.2); border-color: rgba(224,82,82,0.45); }
  .save-icon { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 7px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
  .save-icon:hover { background: var(--vscode-button-hoverBackground); }

  .toc { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin: 0.2rem 0 1rem; font-size: 0.9em; }
  .toc a { color: var(--vscode-textLink-foreground); text-decoration: none; }
  .toc a:hover { text-decoration: underline; }

  .sec { margin: 1.1rem 0; }
  .sec > summary { font-size: 1.16em; font-weight: 600; cursor: pointer; padding: 0.3rem 0 0.3rem 0.55rem; border-left: 3px solid var(--vscode-textLink-foreground); list-style: none; user-select: none; }
  .sec > summary::-webkit-details-marker { display: none; }
  .sec > summary::before { content: '▾'; display: inline-block; width: 1em; color: var(--vscode-descriptionForeground); }
  .sec:not([open]) > summary::before { content: '▸'; }
  .sec-body { padding: 0.5rem 0 0.2rem; }

  /* Diagram on the left; narrative + tables stacked in the right column so they stay visible
     alongside a tall diagram instead of being pushed below it. Wraps to one column when narrow. */
  .report-row { display: flex; flex-wrap: wrap; gap: 1.75rem; align-items: flex-start; }
  .diagram-col { flex: 0 1 auto; min-width: 260px; max-width: 100%; }
  .detail-col { flex: 1 1 420px; min-width: 320px; }
  .detail-col p { max-width: 60ch; }
  .diagram { overflow-x: auto; max-width: 100%; padding: 0.4rem 0 1rem; }

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
