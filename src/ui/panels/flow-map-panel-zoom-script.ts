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
  function resetView(){ scale = fitScale(); applyScale(); scroll.scrollLeft = 0; scroll.scrollTop = 0; }

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
    scroll.scrollLeft = (b.x + b.width / 2) * scale - scroll.clientWidth / 2;
    scroll.scrollTop = (b.y + b.height / 2) * scale - scroll.clientHeight / 2;
    crash.classList.remove('fm-flash'); void crash.getBBox(); crash.classList.add('fm-flash');
  }

  var ZOOM = { in: function(){ zoomTo(scale * 1.2); }, out: function(){ zoomTo(scale / 1.2); }, reset: resetView, crash: centerCrash };
  document.querySelectorAll('.fm-zoom-btn').forEach(function(btn){
    var act = btn.getAttribute('data-zoom');
    if (act === 'popout') { btn.addEventListener('click', function(){ send('popOutFlow'); }); return; }
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
