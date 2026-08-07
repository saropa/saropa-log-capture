/**
 * Styles for screenshots in the flow-map panel: the thumbnails drawn on diagram cards and the
 * full-size lightbox. Split from `flow-map-panel-styles.ts` to keep that file inside the line budget;
 * `flowMapStyles()` concatenates this chunk into the same nonce-guarded `<style>` block.
 */

/** CSS text (no `<style>` wrapper) for diagram thumbnails and the screenshot lightbox. */
export function flowMapShotStyles(): string {
    return `
  /* Diagram card thumbnails: the capture fills a fixed frame (cropped from the bottom, see
     thumbMarkup) with a hairline border so a pale screenshot still reads as a distinct panel. */
  .fm-shot { cursor: pointer; }
  .fm-shot:hover, .fm-shot:focus { filter: brightness(1.12); outline: none; }
  .fm-shot-frame { stroke: var(--border); pointer-events: none; }
  .fm-node:hover .fm-shot-frame, .fm-node:focus .fm-shot-frame { stroke: var(--vscode-focusBorder); }
  /* Multi-capture pill sits ON the thumbnail, so it needs its own opaque backing rather than the
     card fill — over a photo, a translucent chip is unreadable. */
  .fm-shot-pill { fill: var(--surface-1); stroke: var(--border); stroke-width: 1; }
  .fm-shot-pill-text { fill: var(--text); }

  /* Screenshot lightbox: centered card over a dimmed backdrop, sized to the viewport so the capture
     shows at the largest size that still leaves its facts visible. */
  .fms-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 1.2rem; background: rgba(0,0,0,0.62); }
  .fms-card { position: relative; display: flex; flex-direction: column; gap: 0.6rem; max-width: min(92vw, 900px); max-height: 92vh; overflow: auto; padding: 1.1rem 1.3rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
  /* min-height:0 lets the image shrink inside the flex column instead of overflowing the card. */
  .fms-img { min-height: 0; max-width: 100%; max-height: 70vh; object-fit: contain; align-self: center; border: 1px solid var(--border); border-radius: var(--radius); background: rgba(0,0,0,0.25); }
  .fms-close { position: absolute; top: 0.5rem; right: 0.5rem; border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 1rem; padding: 0.15rem 0.4rem; border-radius: 5px; }
  .fms-close:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.18)); color: var(--text); }
  .fms-count { font-size: 0.85em; color: var(--muted); text-align: center; }
  .fms-grid { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 0.9rem; font-size: 0.92em; }
  .fms-k { color: var(--muted); }
  .fms-v { word-break: break-word; }
  .fms-link { color: var(--link); cursor: pointer; font-family: var(--vscode-editor-font-family); }
  .fms-link:hover { text-decoration: underline; color: var(--vscode-textLink-activeForeground); }`;
}
