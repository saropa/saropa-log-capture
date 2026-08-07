/**
 * Client script for the screenshot lightbox. Any capture in the panel — a diagram card's thumbnail
 * (`img.fm-shot`, inside a `<foreignObject>` on the SVG) or a gallery figure (`img.shot-img`) —
 * opens a full-size overlay with its capture facts and a reveal-in-log action. Both surfaces are
 * plain `<img>`, so one selector covers them; see `thumbMarkup` for why the diagram is not an SVG
 * `<image>`.
 *
 * This script also owns the thumbnails' load-failure state, because it is already the one module
 * that addresses both surfaces at once.
 *
 * Kept as its own nonce-guarded `<script>` (like the zoom and replay scripts) so each diagram feature
 * owns its state machine and no single file drifts over the line budget. Clicks on a thumbnail
 * `stopPropagation()` because the enclosing `.fm-node` group has its own click (row highlight + log
 * jump) and dblclick (detail popup) handlers — without that, opening a screenshot would also scroll
 * the log viewer out from under the reader.
 */

import { flowMapLightboxZoomJs } from './flow-map-panel-lightbox-zoom';
import { flowMapLightboxCompareJs, type CompareSessionRef } from './flow-map-panel-lightbox-compare';

/** Labels the overlay renders, resolved host-side so the webview needs no l10n runtime. */
export interface LightboxLabels {
    readonly title: string;
    readonly captured: string;
    readonly trigger: string;
    readonly screen: string;
    readonly logLine: string;
    readonly close: string;
    /** Position within the whole gallery — used by gallery figures. */
    readonly counter: string;
    /** Position within one screen's captures — used by diagram thumbnails (data-shot-scope="screen"). */
    readonly counterScreen: string;
    /** Row label for the capture's filename. */
    readonly file: string;
    /** Copy-button tooltip — copies the FULL path, not the filename shown beside it. */
    readonly copyPath: string;
    readonly zoom: string;
    readonly zoomHint: string;
    /** Tooltip on a thumbnail whose PNG failed to load (deleted, moved, or outside the resource root). */
    readonly unavailable: string;
    /** Compare toggle, shown only when the screen has more than one capture. */
    readonly compare: string;
    readonly comparePrev: string;
    readonly compareNext: string;
    /** Session picker: its own label, the "stay here" option, and the two outcome messages. */
    readonly compareSession: string;
    readonly compareThisSession: string;
    readonly compareLoading: string;
    readonly compareNoMatch: string;
}

/** The full `<script>` block wiring the screenshot lightbox, nonce-guarded for CSP. */
export function flowMapLightboxScript(
    nonce: string, labels: LightboxLabels, sessions: readonly CompareSessionRef[] = [],
): string {
    return `<script nonce="${nonce}">(function(){
  var L = ${JSON.stringify(labels)};
  var overlay = null;
  var opener = null;
${flowMapLightboxZoomJs()}
${flowMapLightboxCompareJs(sessions)}

  function close(){
    if (overlay) { overlay.remove(); overlay = null; }
    // Return focus where it came from: the diagram and the gallery are both keyboard-navigable, and
    // dropping focus to <body> on close would send the next Tab back to the top of the panel.
    if (opener && opener.focus) { opener.focus(); }
    opener = null;
  }

  // Real modal semantics for aria-modal="true": every focusable behind the overlay (diagram nodes,
  // thumbnails, gallery figures, links) is still tabbable, so without this a keyboard user Tabs
  // straight out of the "modal" into content the backdrop is visually blocking.
  function trapTab(card, e){
    if (e.key !== 'Tab') { return; }
    // Every NATIVELY focusable element, not just the ones the card happens to build today — a future
    // control added without an explicit tabindex would otherwise fall outside the trap and leak focus.
    var f = card.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
      + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (f.length === 0) { return; }
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Build the facts grid with textContent (never innerHTML): a capture's screen label and trigger
  // come from log text, so interpolating them into markup would let a log line inject nodes.
  function addRow(grid, k, v){
    if (!v) { return; }
    var kd = document.createElement('div');
    kd.className = 'fms-k';
    kd.textContent = k;
    var vd = document.createElement('div');
    vd.className = 'fms-v';
    vd.textContent = v;
    grid.appendChild(kd);
    grid.appendChild(vd);
  }

  /* Filename plus a copy button for the FULL path. The filename alone is what identifies a capture
     at a glance (001_error_….png); the path is what gets pasted somewhere, and is too long to read
     inline in a facts grid, so it travels on the button instead of on screen. */
  function addPathRow(grid, path){
    if (!path) { return; }
    var kd = document.createElement('div');
    kd.className = 'fms-k';
    kd.textContent = L.file;
    var vd = document.createElement('div');
    vd.className = 'fms-v fms-path';
    var name = document.createElement('span');
    name.className = 'fms-file';
    name.title = path;
    name.textContent = path.split(/[\\\\/]/).pop() || path;
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'fms-copy';
    copy.title = L.copyPath;
    copy.setAttribute('aria-label', L.copyPath);
    copy.textContent = '⧉';
    copy.addEventListener('click', function(){
      if (window.__fmSend) { window.__fmSend('copyShotPath', { text: path }); }
    });
    vd.appendChild(name);
    vd.appendChild(copy);
    grid.appendChild(kd);
    grid.appendChild(vd);
  }

  function addLogRow(grid, line){
    if (!line || line <= 0) { return; }
    var kd = document.createElement('div');
    kd.className = 'fms-k';
    kd.textContent = L.logLine;
    var vd = document.createElement('div');
    vd.className = 'fms-v';
    var link = document.createElement('span');
    link.className = 'fms-link';
    link.setAttribute('role', 'link');
    link.setAttribute('tabindex', '0');
    link.textContent = 'L' + line;
    function go(){ if (window.__fmSend) { window.__fmSend('revealLogLine', { line: line }); } }
    link.addEventListener('click', go);
    link.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    vd.appendChild(link);
    grid.appendChild(kd);
    grid.appendChild(vd);
  }

  // "3 of 7" — which capture of the set this is. The diagram thumbnail shows only ONE of a screen's
  // captures (the fault one when there is one, else the first), so this is how a reader learns the
  // pill's other captures exist and where in the gallery to find them.
  function counterText(el){
    var i = el.getAttribute('data-shot-index');
    var n = el.getAttribute('data-shot-total');
    if (!i || !n || n === '1') { return ''; }
    var tpl = el.getAttribute('data-shot-scope') === 'screen' ? L.counterScreen : L.counter;
    return tpl.replace('{0}', i).replace('{1}', n);
  }

  /* The zoom strip under the capture: a reset-to-fit button, the slider, and the live percentage.
     Built here (not in the zoom module) so the module stays behavior-only and this file keeps every
     piece of the dialog's DOM in one place. */
  function zoomBar(stage, img){
    var bar = document.createElement('div');
    bar.className = 'fms-zoombar';
    var fit = document.createElement('button');
    fit.type = 'button';
    fit.className = 'fms-zoom-fit';
    fit.title = L.zoom;
    fit.textContent = '⧉';
    fit.addEventListener('click', zoomReset);
    var label = document.createElement('span');
    label.className = 'fms-k';
    label.textContent = L.zoom;
    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'fms-zoom-range';
    slider.min = '25';
    slider.max = '800';
    slider.value = '100';
    slider.title = L.zoomHint;
    slider.setAttribute('aria-label', L.zoom);
    var pct = document.createElement('span');
    pct.className = 'fms-zoom-pct';
    bar.appendChild(fit);
    bar.appendChild(label);
    bar.appendChild(slider);
    bar.appendChild(pct);
    zoomAttach(stage, img, slider, pct);
    return bar;
  }

  function open(el, src){
    close();
    // Captured BEFORE the overlay steals focus, so close() can hand it back to the exact thumbnail.
    opener = el;
    overlay = document.createElement('div');
    overlay.className = 'fms-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var card = document.createElement('div');
    card.className = 'fms-card';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'fms-close';
    closeBtn.title = L.close;
    closeBtn.setAttribute('aria-label', L.close);
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', close);
    // The image lives in its own scroll box: once zoomed past the card it must scroll, not overflow
    // the dialog (which would put the facts grid out of reach behind the capture).
    var stage = document.createElement('div');
    stage.className = 'fms-stage';
    var img = document.createElement('img');
    img.className = 'fms-img';
    img.src = src;
    img.alt = el.getAttribute('data-shot-screen') || L.title;
    stage.appendChild(img);
    var grid = document.createElement('div');
    grid.className = 'fms-grid';
    addRow(grid, L.screen, el.getAttribute('data-shot-screen'));
    addRow(grid, L.captured, el.getAttribute('data-shot-clock'));
    addRow(grid, L.trigger, el.getAttribute('data-shot-trigger'));
    addPathRow(grid, el.getAttribute('data-shot-path'));
    addLogRow(grid, parseInt(el.getAttribute('data-shot-line') || '0', 10));
    card.appendChild(closeBtn);
    card.appendChild(stage);
    // cmpBar appends the (hidden) compare panes to the card itself and returns just its controls, so
    // the panes land directly under the stage they replace rather than inside the control strip.
    var compareBar = cmpBar(card, stage, {
        src: src, clock: el.getAttribute('data-shot-clock') || '', trigger: el.getAttribute('data-shot-trigger') || '',
    }, el);
    card.appendChild(zoomBar(stage, img));
    if (compareBar) { card.appendChild(compareBar); }
    var count = counterText(el);
    if (count) {
      var cd = document.createElement('div');
      cd.className = 'fms-count';
      cd.textContent = count;
      card.appendChild(cd);
    }
    card.appendChild(grid);
    overlay.appendChild(card);
    // Backdrop click closes; a click inside the card must not bubble out and close it immediately.
    overlay.addEventListener('click', close);
    card.addEventListener('click', function(e){ e.stopPropagation(); });
    overlay.addEventListener('keydown', function(e){ trapTab(card, e); });
    document.body.appendChild(overlay);
    closeBtn.focus();
  }

  function bind(el, srcOf){
    function activate(e){
      // The SVG thumbnail sits inside .fm-node, which owns click/dblclick of its own.
      e.stopPropagation();
      e.preventDefault();
      open(el, srcOf());
    }
    el.addEventListener('click', activate);
    el.addEventListener('dblclick', function(e){ e.stopPropagation(); });
    el.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { activate(e); } });
  }

  // Both surfaces are plain <img> now — the diagram's lives inside a <foreignObject> (see
  // thumbMarkup), so one selector and one src accessor cover the gallery and the cards alike.
  document.querySelectorAll('img.shot-img, img.fm-shot').forEach(function(img){
    bind(img, function(){ return img.src; });
    // A capture that existed when the report was built can be gone by the time the browser fetches
    // it, and a wrong localResourceRoots fails the same way. Without this the reader gets the
    // browser's broken-image glyph and no statement of what happened — the report would be lying
    // about a capture it can no longer show. The class swaps the frame for a visible failed state
    // and drops the click target, since there is nothing to open.
    img.addEventListener('error', function(){
      img.classList.add('fm-shot-missing');
      img.removeAttribute('role');
      img.removeAttribute('tabindex');
      img.title = L.unavailable;
    });
  });

  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && overlay) { close(); } });
  // The only inbound message this panel handles: another session's captures of the open screen.
  window.addEventListener('message', function(e){
    if (e.data && e.data.type === 'flowMapCompareShots') { cmpApplyShots(e.data); }
  });
})();</script>`;
}
