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

  // Convert the node's viewBox-space bbox into current on-screen scroll coordinates. Computed from
  // the SVG's live rendered width (not a shared "scale" var) since this script's IIFE never sees the
  // zoom script's internal state.
  function centerOn(el){
    var vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
    var baseW = vb[2] || svg.clientWidth || 1;
    var rect = svg.getBoundingClientRect();
    var s = rect.width / baseW;
    var b = el.getBBox();
    scroll.scrollLeft = (b.x + b.width / 2) * s - scroll.clientWidth / 2;
    scroll.scrollTop = (b.y + b.height / 2) * s - scroll.clientHeight / 2;
  }

  function clearHighlight(){
    var lit = svg.querySelector('.fm-replay-hl');
    if (lit) { lit.classList.remove('fm-replay-hl'); }
  }

  function stop(){
    if (timer) { clearInterval(timer); timer = null; }
    clearHighlight();
    btn.classList.remove('fm-zoom-active');
  }

  function advance(){
    clearHighlight();
    if (idx >= steps.length) { stop(); return; }
    var el = steps[idx++];
    el.classList.add('fm-replay-hl');
    centerOn(el);
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
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && timer) { stop(); } });
})();</script>`;
}
