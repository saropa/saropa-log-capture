/**
 * Client script for the flow-map "▶ Replay" toolbar button. Steps through the WALKED nodes (excluding
 * the synthetic `launch` node) in visit order, highlighting one at a time and scrolling it into view,
 * so a reader can watch the session walk unfold instead of reading the dwell table top to bottom. Kept
 * as its own nonce-guarded `<script>` (separate from flow-map-panel-zoom-script.ts) so this feature's
 * state machine does not push that file over the line budget; it reads the SAME `.fm-node` DOM the
 * zoom script wires up, but runs in its own IIFE scope, so it recomputes scroll centering independently
 * rather than reaching into the zoom script's private `scale` variable.
 */

/** The full `<script>` block wiring the Replay button, nonce-guarded for CSP. */
export function flowMapReplayScript(nonce: string): string {
    return `<script nonce="${nonce}">(function(){
  var scroll = document.querySelector('.diagram-scroll');
  var svg = scroll && scroll.querySelector('svg');
  var btn = document.querySelector('.fm-zoom-btn[data-zoom="replay"]');
  if (!scroll || !svg || !btn) { return; }

  var STEP_MS = 900;
  var timer = null;
  var steps = [];
  var idx = 0;

  // Read each walked node's data-detail JSON (same attribute the zoom script parses for the detail
  // popup) and sort by firstTsMs so replay follows the order the screens were actually entered.
  function collectSteps(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.fm-node'));
    var walked = [];
    nodes.forEach(function(g){
      var raw = g.getAttribute('data-detail');
      if (!raw) { return; }
      var d;
      try { d = JSON.parse(raw); } catch (err) { return; }
      if (!d.walked || d.kind === 'launch') { return; }
      walked.push({ el: g, ts: d.firstTsMs || 0 });
    });
    walked.sort(function(a, b){ return a.ts - b.ts; });
    return walked.map(function(w){ return w.el; });
  }

  // Center in SCREEN space: shift the scroll box by the delta between the node's on-screen center
  // and the scroll box's center. Rect math already includes whatever zoom the zoom script applied,
  // so this stays correct at any scale — no viewBox/scale reconstruction to drift out of sync.
  function centerOn(el){
    var nb = el.getBoundingClientRect();
    var sb = scroll.getBoundingClientRect();
    scroll.scrollLeft += (nb.left + nb.width / 2) - (sb.left + sb.width / 2);
    scroll.scrollTop += (nb.top + nb.height / 2) - (sb.top + sb.height / 2);
  }

  function clearHighlight(){
    var lit = svg.querySelector('.fm-replay-hl');
    if (lit) { lit.classList.remove('fm-replay-hl'); }
  }

  function hidePreview(){
    var el = document.getElementById('fm-replay-preview');
    if (el) { el.style.display = 'none'; }
  }

  // Floating screenshot beside the highlighted node: the gallery figure whose data-screen-key equals
  // the node's data-rowkey supplies the (already-loaded) data-URI img, so no new image fetch happens.
  // Absent in the pop-out (no gallery in its DOM) — the lookup just misses and nothing shows.
  function showPreview(nodeEl){
    var key = nodeEl.getAttribute('data-rowkey');
    var fig = null;
    if (key && window.CSS && CSS.escape) {
      fig = document.querySelector('.shot-fig[data-screen-key="' + CSS.escape(key) + '"]');
    }
    var img = fig ? fig.querySelector('img') : null;
    if (!img) { hidePreview(); return; }
    var el = document.getElementById('fm-replay-preview');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fm-replay-preview';
      el.className = 'fm-replay-preview';
      document.body.appendChild(el);
    }
    var cap = fig.querySelector('.shot-cap');
    el.innerHTML = '';
    var clone = document.createElement('img');
    clone.src = img.src;
    clone.alt = '';
    el.appendChild(clone);
    if (cap) {
      var c = document.createElement('div');
      c.className = 'fm-replay-preview-cap';
      c.textContent = cap.textContent || '';
      el.appendChild(c);
    }
    el.style.display = 'block';
    // Position AFTER centering: the node's rect is fresh post-scroll. Right of the node when there
    // is room, else to its left; clamped into the viewport.
    var nb = nodeEl.getBoundingClientRect();
    var w = 230;
    var left = (nb.right + 12 + w <= window.innerWidth) ? nb.right + 12 : Math.max(8, nb.left - 12 - w);
    el.style.left = left + 'px';
    el.style.top = Math.max(8, Math.min(nb.top, window.innerHeight - 240)) + 'px';
  }

  function stop(){
    if (timer) { clearInterval(timer); timer = null; }
    clearHighlight();
    hidePreview();
    btn.classList.remove('fm-zoom-active');
  }

  function advance(){
    clearHighlight();
    if (idx >= steps.length) { stop(); return; }
    var el = steps[idx++];
    el.classList.add('fm-replay-hl');
    centerOn(el);
    showPreview(el);
  }

  function start(){
    steps = collectSteps();
    if (steps.length === 0) { return; }
    idx = 0;
    btn.classList.add('fm-zoom-active');
    advance();
    timer = setInterval(advance, STEP_MS);
  }

  btn.addEventListener('click', function(){ if (timer) { stop(); } else { start(); } });
  document.addEventListener('keydown', function(e){
    // When an overlay is open (node detail, screenshot lightbox), Escape belongs to it — closing the
    // overlay while the replay keeps stepping matches how users layer dismissals; only a bare Escape
    // stops the replay.
    if (e.key === 'Escape' && timer && !document.querySelector('.fmd-overlay, .fms-overlay')) { stop(); }
  });
})();</script>`;
}
