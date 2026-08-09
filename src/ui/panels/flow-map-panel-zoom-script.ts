/**
 * Client script for the flow-map diagram lens (plan 056, S3). Replaces the old viewBox-mutating
 * zoom — which clipped content and let "center the fault" zoom the whole chart away — with a
 * CSS-size zoom model: the SVG keeps a static viewBox and its element width/height are scaled, so
 * the `.diagram-scroll` container grows real scrollbars (no cropping) and centers the chart via
 * margin:auto when it is smaller than the viewport. Also wires the pop-out button and the
 * double-click "exhaustive node detail" popup. Messaging reuses `window.__fmSend` from the main
 * panel script (acquireVsCodeApi may be called only once per webview).
 */

import { t } from '../../l10n';

/** Localized labels injected into the client so the detail popup is translation-ready. */
function detailLabels(): string {
    return JSON.stringify({
        type: t('flowMap.detailType'),
        state: t('flowMap.detailState'),
        visits: t('flowMap.detailVisits'),
        dwell: t('flowMap.detailDwell'),
        first: t('flowMap.detailFirstEntered'),
        last: t('flowMap.detailLastSeen'),
        source: t('flowMap.detailSource'),
        log: t('flowMap.detailLogLine'),
        actions: t('flowMap.detailActions'),
        issues: t('flowMap.detailIssues'),
        walked: t('flowMap.detailWalked'),
        walkedResolved: t('flowMap.detailWalkedResolved'),
        notWalked: t('flowMap.detailNotWalked'),
        close: t('flowMap.detailClose'),
        dialog: t('flowMap.detailDialogTitle'),
    });
}

/** The full `<script>` block for the diagram lens, nonce-guarded for CSP. */
export function flowMapZoomScript(nonce: string): string {
    return `<script nonce="${nonce}">(function(){
  var scroll = document.querySelector('.diagram-scroll');
  var svg = scroll && scroll.querySelector('svg');
  if (!svg) { return; }
  var send = window.__fmSend || function(){};
  var L = ${detailLabels()};

  // The viewBox is the static "fit" coordinate system; zoom scales the element box, not the viewBox.
  var vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
  var BASE_W = vb[2] || svg.clientWidth || 1;
  var BASE_H = vb[3] || svg.clientHeight || 1;
  var MIN_SCALE = 0.2, MAX_SCALE = 4;
  var scale = 1;

  function applyScale(){ svg.style.width = Math.round(BASE_W * scale) + 'px'; svg.style.height = Math.round(BASE_H * scale) + 'px'; }

  // Fit the whole chart inside the viewport without upscaling past 1:1; margin:auto then centers it.
  function fitScale(){
    var aw = scroll.clientWidth - 8, ah = scroll.clientHeight - 8;
    var f = Math.min(aw / BASE_W, ah > 0 ? ah / BASE_H : 1, 1);
    return f > 0 ? f : 1;
  }
  // Reset view is the one deliberate way back to the renderer's own layout, so it also drops any
  // cards the reader dragged (see flow-map-panel-drag-script.ts). Guarded: the drag script is a
  // sibling <script>, and a future panel could ship the lens without it.
  function resetView(){
    if (typeof window.__fmResetNodes === 'function') { window.__fmResetNodes(); }
    // Reset drops the by-time arrangement with everything else, so its control must stop reading as
    // engaged — a lit button over a depth layout is the control lying about the mode it is in.
    var timeBtn = document.querySelector('.fm-zoom-btn[data-zoom="time"]');
    if (timeBtn) { timeBtn.classList.remove('fm-zoom-active'); }
    scale = fitScale(); applyScale(); scroll.scrollLeft = 0; scroll.scrollTop = 0;
  }

  /* By-time arrangement: a MODE, so the button stays lit while it is on. The layout itself lives in
     the drag script's IIFE (it drives the same setOffset/re-route path); this only owns the toolbar
     side of it. Guarded because that script is a sibling block a panel could ship without. */
  function arrangeByTime(btn){
    if (typeof window.__fmArrangeByTime !== 'function') { return; }
    btn.classList.toggle('fm-zoom-active', window.__fmArrangeByTime());
  }

  // Zoom anchored at a client point (cursor) so the content under it stays put across the rescale.
  function zoomTo(next, cx, cy){
    next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    var r = scroll.getBoundingClientRect();
    var ax = (cx == null ? r.width / 2 : cx - r.left);
    var ay = (cy == null ? r.height / 2 : cy - r.top);
    var contentX = (scroll.scrollLeft + ax) / scale;
    var contentY = (scroll.scrollTop + ay) / scale;
    scale = next; applyScale();
    scroll.scrollLeft = contentX * scale - ax;
    scroll.scrollTop = contentY * scale - ay;
  }

  svg.addEventListener('wheel', function(e){ e.preventDefault(); zoomTo(scale * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX, e.clientY); }, { passive: false });

  // Drag the background to pan (scrolls the container). Node clicks/double-clicks are left untouched.
  var panning = false, sx = 0, sy = 0, sl = 0, st = 0, moved = false;
  svg.addEventListener('pointerdown', function(e){
    if (e.button !== 0 || e.target.closest('.fm-node')) { return; }
    panning = true; moved = false; sx = e.clientX; sy = e.clientY; sl = scroll.scrollLeft; st = scroll.scrollTop;
    svg.setPointerCapture(e.pointerId); scroll.classList.add('fm-panning');
  });
  svg.addEventListener('pointermove', function(e){
    if (!panning) { return; }
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) { moved = true; }
    scroll.scrollLeft = sl - (e.clientX - sx); scroll.scrollTop = st - (e.clientY - sy);
  });
  function endPan(){ panning = false; scroll.classList.remove('fm-panning'); }
  svg.addEventListener('pointerup', endPan);
  svg.addEventListener('pointercancel', endPan);
  // A pan that moved must not also fire the node click underneath when released over a node.
  svg.addEventListener('click', function(e){ if (moved) { e.stopPropagation(); moved = false; } }, true);

  // Center the viewport on the crash node at a readable zoom (>= 1:1). The old code set the viewBox
  // wider than the whole canvas, which read as a massive zoom-OUT — here we only scroll to the node.
  function centerCrash(){
    var crash = svg.querySelector('.fm-node.fm-crash');
    if (!crash) { return; }
    scale = Math.max(scale, 1); applyScale();
    var b = crash.getBBox();
    // getBBox reports the group's OWN user space and excludes its transform, so a card the reader
    // dragged (or that the by-time arrangement moved) would center on where it used to be — the
    // control would scroll to blank canvas and flash a card that is not on screen.
    var off = (typeof window.__fmOffsetOf === 'function' && window.__fmOffsetOf(crash)) || { dx: 0, dy: 0 };
    scroll.scrollLeft = (b.x + off.dx + b.width / 2) * scale - scroll.clientWidth / 2;
    scroll.scrollTop = (b.y + off.dy + b.height / 2) * scale - scroll.clientHeight / 2;
    crash.classList.remove('fm-flash'); void crash.getBBox(); crash.classList.add('fm-flash');
  }

  /* Export the diagram exactly as it is on screen — whatever the reader dragged or arranged by
     time — as a standalone .svg a bug report or a PR description can embed. The exported file must
     render on its own outside this webview, so this is not a plain serialization of the live
     element: colors come from var(--vscode-*) tokens the webview's own document defines, and the
     zoom's inline width/height on the live <svg> is a display SCALE, not the diagram's real size.

     Both are resolved by baking each element's COMPUTED style into a clone before serializing —
     the clone is what gets read and thrown away, so the live diagram is never touched. Limited to a
     fixed, small property list: the goal is "the diagram reads correctly standalone", not a
     faithful re-creation of every CSS rule the panel applies (hover states, focus rings and
     animations have no meaning in a static file and are deliberately left out).

     No background rect is added — the export is transparent, like the SVG a diagramming tool would
     hand you, and renders atop whatever the viewer's own background is. */
  var EXPORT_PROPS = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'fill-opacity',
    'opacity', 'font-family', 'font-size', 'font-weight', 'color',
  ];

  function bakeComputedStyle(liveEl, targetEl){
    var cs = getComputedStyle(liveEl);
    var decl = '';
    EXPORT_PROPS.forEach(function(p){
      var v = cs.getPropertyValue(p);
      if (v) { decl += p + ':' + v.trim() + ';'; }
    });
    // Always cleared first: a leftover inline style (the live root's zoom-scale width/height, most
    // notably) must not survive into the export just because this element had nothing to bake.
    targetEl.removeAttribute('style');
    if (decl) { targetEl.setAttribute('style', decl); }
  }

  /* A card's screenshot thumbnail (thumbMarkup in flow-map-svg-shots.ts) is an <img> inside a
     <foreignObject>, sized entirely by the .fm-shot CSS rule (width/height/object-fit) — none of
     which is in EXPORT_PROPS, so baking would leave it unsized. Worse, its src is a
     vscode-webview://… URL scoped to this live session; the moment the file is saved to disk and
     opened elsewhere (a browser, a PR description — the exact use this button exists for) that URL
     resolves to nothing. A broken-image glyph on every captured card would be worse than no picture
     at all, so the thumbnail is dropped rather than exported broken. The hairline frame drawn AFTER
     it (see thumbMarkup) is left in place, so the card still says "this screen had a capture" —
     just without the capture itself. Run on the CLONE, and only after baking: removing nodes first
     would desync the live/clone NodeList pairing bakeComputedStyle relies on. */
  // Returns the count removed, not just whether any were: "no silent async" applies here — a click
  // that quietly drops information the reader may have wanted (the captures) must say so, not just
  // report the save as if nothing was left out.
  function stripThumbnails(root){
    var shots = root.querySelectorAll('foreignObject');
    for (var i = shots.length - 1; i >= 0; i--) {
      var fo = shots[i];
      if (fo.parentNode) { fo.parentNode.removeChild(fo); }
    }
    return shots.length;
  }

  function exportArrangedSvg(){
    var clone = svg.cloneNode(true);
    bakeComputedStyle(svg, clone);
    var liveEls = svg.querySelectorAll('*');
    var cloneEls = clone.querySelectorAll('*');
    // cloneNode(true) preserves document order exactly, so the two NodeLists walk in lockstep —
    // no matching by id or position needed.
    for (var i = 0; i < liveEls.length; i++) { bakeComputedStyle(liveEls[i], cloneEls[i]); }
    var stripped = stripThumbnails(clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var xml = new XMLSerializer().serializeToString(clone);
    send('exportArrangedSvg', { svg: '<?xml version="1.0" encoding="UTF-8"?>\\n' + xml, shotsOmitted: stripped });
  }

  var ZOOM = { in: function(){ zoomTo(scale * 1.2); }, out: function(){ zoomTo(scale / 1.2); }, reset: resetView, crash: centerCrash };
  document.querySelectorAll('.fm-zoom-btn').forEach(function(btn){
    var act = btn.getAttribute('data-zoom');
    if (act === 'popout') { btn.addEventListener('click', function(){ send('popOutFlow'); }); return; }
    // 'time' needs its own button to toggle the lit state on, so it cannot go through the ZOOM map.
    if (act === 'time') { btn.addEventListener('click', function(){ arrangeByTime(btn); }); return; }
    if (act === 'export-svg') { btn.addEventListener('click', exportArrangedSvg); return; }
    btn.addEventListener('click', function(){ var fn = ZOOM[act]; if (fn) { fn(); } });
  });

  // --- Double-click a node -> exhaustive detail popup. ---
  function esc(x){ return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function clk(ms){
    if (ms == null) { return '\\u2014'; }
    var s = Math.floor(ms / 1000), p = function(n){ return (n < 10 ? '0' : '') + n; };
    return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
  }
  function dwell(ms){
    if (ms == null) { return '\\u2014'; }
    var s = Math.floor(ms / 1000);
    if (s < 1) { return ms + ' ms'; }
    if (s < 60) { return s + ' s'; }
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }
  function row(k, v){ return v ? '<div class="fmd-k">' + esc(k) + '</div><div class="fmd-v">' + v + '</div>' : ''; }

  function openDetail(d){
    var actions = Object.keys(d.actions || {}).map(function(k){ return esc(d.actions[k] + ' ' + k); }).join(', ');
    var issues = (d.issues || []).map(function(i){
      return '<li><b>' + esc(i.sev) + '</b> ' + esc(i.cat) + ' \\u00b7 ' + esc(i.detail) + (i.clock ? ' (' + esc(i.clock) + ')' : '') + '</li>';
    }).join('');
    var srcv = d.file ? '<span class="fmd-link" data-act="src" data-file="' + esc(d.file) + '" data-line="' + (d.fileLine || 1) + '">' + esc(d.file) + (d.fileLine ? ':' + d.fileLine : '') + '</span>' : '';
    var logv = d.logLine ? '<span class="fmd-link" data-act="log" data-line="' + d.logLine + '">L' + d.logLine + '</span>' : '';
    var statev = d.walked ? (d.resolved ? L.walkedResolved : L.walked) : L.notWalked;
    var card = '<div class="fmd-card" role="dialog" aria-modal="true" aria-label="' + esc(L.dialog) + '">'
      + '<button class="fmd-close" title="' + esc(L.close) + '" aria-label="' + esc(L.close) + '">\\u2715</button>'
      + '<h2 class="fmd-title">' + esc(d.label) + '</h2>'
      + '<div class="fmd-grid">'
      + row(L.type, esc(d.kind)) + row(L.state, esc(statev))
      + row(L.visits, esc(d.visits)) + row(L.dwell, esc(dwell(d.dwellMs)))
      + row(L.first, esc(clk(d.firstTsMs))) + row(L.last, esc(clk(d.lastTsMs)))
      + row(L.source, srcv) + row(L.log, logv)
      + row(L.actions, actions ? esc(actions) : '')
      + '</div>'
      + (issues ? '<h3 class="fmd-h3">' + esc(L.issues) + '</h3><ul class="fmd-issues">' + issues + '</ul>' : '')
      + '</div>';
    var overlay = document.createElement('div');
    overlay.className = 'fmd-overlay';
    overlay.innerHTML = card;
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e){ if (e.key === 'Escape') { close(); } }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function(e){
      if (e.target === overlay || e.target.closest('.fmd-close')) { close(); return; }
      var link = e.target.closest('.fmd-link');
      if (!link) { return; }
      if (link.getAttribute('data-act') === 'src') {
        send('openFlowMapSource', { file: link.getAttribute('data-file'), line: parseInt(link.getAttribute('data-line') || '1', 10) });
      } else {
        send('revealLogLine', { line: parseInt(link.getAttribute('data-line') || '0', 10) });
      }
    });
  }
  document.querySelectorAll('.fm-node').forEach(function(g){
    g.addEventListener('dblclick', function(){
      var raw = g.getAttribute('data-detail');
      if (!raw) { return; }
      try { openDetail(JSON.parse(raw)); } catch (err) { /* malformed detail: ignore */ }
    });
  });

  // Fit + center once the section has its real width.
  resetView();
})();</script>`;
}
