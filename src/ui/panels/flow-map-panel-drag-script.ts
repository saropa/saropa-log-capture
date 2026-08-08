/**
 * Client script for repositioning flow-diagram cards. The automatic layout optimizes for a compact
 * canvas, which is the right default and the wrong thing when a reader wants two particular screens
 * side by side, or a fault card out from behind an edge label. Dragging a card moves it; every arrow
 * touching it re-routes live so the diagram never shows a detached edge.
 *
 * HOW EDGES FOLLOW. Each card publishes its laid-out box (`data-nx/ny/nw/nh`) and each edge group
 * publishes the two node keys it joins, so a move is a pure recomputation from those numbers — no
 * DOM measurement, no getBBox, and no second layout model to keep in step with the renderer. The
 * three geometry constants come off the `<svg>`'s `data-geom` for the same reason: they are the
 * renderer's own values, not a copy.
 *
 * The card itself moves by a group `transform`, not by rewriting its children's coordinates: a card
 * is a box, a foreignObject thumbnail, a text stack and a badge, and translating the group keeps
 * them in register whatever is added to it later.
 *
 * The by-time arrangement (flow-map-panel-time-layout.ts) is injected into this script's IIFE and
 * drives the cards through the same `setOffset` path, so an arranged card is just a card with an
 * offset and stays draggable afterwards.
 *
 * POSITIONS ARE NOT PERSISTED. A refresh re-parses the log and re-lays out the graph, so a stored
 * offset would apply to a card the layout has already moved somewhere else — a saved arrangement
 * would silently become a scrambled one. The Reset view button clears the arrangement explicitly.
 */

import { flowMapTimeLayoutJs } from './flow-map-panel-time-layout';

/** The full `<script>` block for card dragging, nonce-guarded for CSP. */
export function flowMapDragScript(nonce: string): string {
    return `<script nonce="${nonce}">(function(){
  var scroll = document.querySelector('.diagram-scroll');
  var svg = scroll && scroll.querySelector('svg');
  if (!svg) { return; }

  // Movement (in CSS pixels) before a press counts as a drag rather than a click. A card carries a
  // click (highlight its table row + jump the log) and a double-click (detail popup), so a small
  // tremor during a click must not shift the layout.
  var DRAG_SLOP = 4;

  var vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
  var BASE_W = vb[2] || 1;
  var geom = (svg.getAttribute('data-geom') || '8,22,14').split(',').map(Number);
  var LABEL_GAP = geom[0], BACK_BULGE = geom[1], BACK_STAGGER = geom[2];

  /* Object.create(null), not {}: these are keyed by NODE KEY, which is derived from the app's own
     log text. A screen that normalizes to "__proto__" would otherwise reassign the object's
     prototype instead of adding an entry, and the next read would hand back the prototype rather
     than an array — throwing mid-loop and leaving every edge after it un-wired. */
  var nodes = Object.create(null);      // node key -> { el, x, y, w, h, ts }
  var incident = Object.create(null);   // node key -> edge groups touching it
  var offsets = Object.create(null);    // node key -> { dx, dy }, absent until the card is dragged
  /* Whether the cards currently sit in the by-time arrangement (see flow-map-panel-time-layout.ts).
     Declared HERE, not in that module, because the reset path below has to clear it: Reset view
     drops every offset, and a flag left set would make the next press of the by-time control try to
     un-arrange an arrangement that is no longer on screen. */
  var arranged = false;

  function num(el, name){ return parseFloat(el.getAttribute(name) || '0'); }

  /* The card group an event landed in. Element.closest is the right tool and works from an HTML
     <img> inside a <foreignObject> as well as from an SVG shape — but the whole feature is dead if
     that ever stops holding on some engine, and the failure would be silent (cards simply refuse to
     move). The parentNode walk is the same answer by a route that cannot depend on it: parentNode,
     unlike parentElement, crosses any node type it meets. */
  function nodeGroupOf(target){
    if (!target) { return null; }
    if (target.closest) {
      var found = target.closest('.fm-node');
      if (found) { return found; }
    }
    for (var el = target; el; el = el.parentNode) {
      if (el.classList && el.classList.contains('fm-node')) { return el; }
    }
    return null;
  }

  // Keys are unique by construction — the renderer places nodes into a Map keyed by the same
  // string, so two cards with one key cannot both reach the markup. Written as a plain assignment
  // rather than a guarded insert because a "first wins" rule here would only hide a renderer bug.
  svg.querySelectorAll('.fm-node[data-key]').forEach(function(g){
    nodes[g.getAttribute('data-key')] = {
      el: g, x: num(g, 'data-nx'), y: num(g, 'data-ny'), w: num(g, 'data-nw'), h: num(g, 'data-nh'),
      ts: g.hasAttribute('data-ts') ? num(g, 'data-ts') : null,
    };
  });
  svg.querySelectorAll('g.fm-edge').forEach(function(g){
    [g.getAttribute('data-from'), g.getAttribute('data-to')].forEach(function(k){
      if (!k) { return; }
      (incident[k] = incident[k] || []).push(g);
    });
  });

  /* The card's CURRENT box: its laid-out position plus whatever the reader has dragged it by. */
  function boxOf(key){
    var n = nodes[key];
    if (!n) { return null; }
    var o = offsets[key];
    return { x: n.x + (o ? o.dx : 0), y: n.y + (o ? o.dy : 0), w: n.w, h: n.h };
  }

  /* Forward edge: source's bottom-center to target's top-center, dwell label parked to the right of
     the shaft. Mirrors renderEdge in flow-map-svg.ts. */
  function rerouteForward(g, from, to){
    var x1 = from.x + from.w / 2, y1 = from.y + from.h;
    var x2 = to.x + to.w / 2, y2 = to.y;
    var line = g.querySelector('.fm-e-fwd');
    if (line) {
      line.setAttribute('x1', x1.toFixed(1)); line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1)); line.setAttribute('y2', y2.toFixed(1));
    }
    var label = g.querySelector('.fm-e-label');
    if (label) {
      label.setAttribute('x', ((x1 + x2) / 2 + LABEL_GAP).toFixed(1));
      label.setAttribute('y', ((y1 + y2) / 2).toFixed(1));
    }
  }

  /* Back edge: a cubic bowing to the right of both cards, in the same stagger lane the renderer
     assigned it — recomputing the lane here would let two returns land on top of each other the
     moment a drag changed which card is rightmost. Mirrors renderBackEdge. */
  function rerouteBack(g, from, to){
    var x1 = from.x + from.w, y1 = from.y + from.h / 2;
    var x2 = to.x + to.w, y2 = to.y + to.h / 2;
    var lane = parseInt(g.getAttribute('data-backidx') || '0', 10);
    var bx = Math.max(x1, x2) + BACK_BULGE + lane * BACK_STAGGER;
    var path = g.querySelector('.fm-e-back');
    if (path) {
      path.setAttribute('d', 'M' + x1.toFixed(1) + ',' + y1.toFixed(1)
        + ' C' + bx.toFixed(1) + ',' + y1.toFixed(1)
        + ' ' + bx.toFixed(1) + ',' + y2.toFixed(1)
        + ' ' + x2.toFixed(1) + ',' + y2.toFixed(1));
    }
    var label = g.querySelector('.fm-e-back-label');
    if (label) {
      label.setAttribute('x', (bx + 4).toFixed(1));
      label.setAttribute('y', ((y1 + y2) / 2).toFixed(1));
    }
  }

  function reroute(g){
    var from = boxOf(g.getAttribute('data-from'));
    var to = boxOf(g.getAttribute('data-to'));
    // An edge naming a node this render did not place is already invisible; leave it alone rather
    // than writing NaN coordinates, which browsers drop silently and with no console error.
    if (!from || !to) { return; }
    if (g.getAttribute('data-back')) { rerouteBack(g, from, to); } else { rerouteForward(g, from, to); }
  }

  function setOffset(key, dx, dy){
    var n = nodes[key];
    if (!n) { return; }
    offsets[key] = { dx: dx, dy: dy };
    n.el.setAttribute('transform', 'translate(' + dx.toFixed(1) + ',' + dy.toFixed(1) + ')');
    (incident[key] || []).forEach(reroute);
  }

  /* Client pixels -> diagram units. The lens zooms by scaling the SVG element's width against a
     static viewBox, so the live ratio is the only correct divisor — dragging at 40% zoom without it
     moves the card two and a half times as far as the pointer went. */
  function scaleNow(){
    var w = svg.getBoundingClientRect().width;
    return w > 0 ? w / BASE_W : 1;
  }

  var drag = null, suppressClick = false;

  svg.addEventListener('pointerdown', function(e){
    if (e.button !== 0) { return; }
    var g = nodeGroupOf(e.target);
    var key = g && g.getAttribute('data-key');
    if (!key) { return; }
    // NOT preventDefault() here. Suppressing the default pointerdown action also suppresses
    // focus-on-mousedown, so a plain click on a card would stop focusing it — no focus ring, and
    // the next Tab would resume from wherever focus had been left instead of from the card the
    // reader just clicked. The lens's pan handler already ignores anything inside .fm-node, so
    // there is no gesture to claim; what actually needs suppressing is the browser's native
    // image-drag, and that is a dragstart, handled below.
    var o = offsets[key];
    drag = {
      g: g, key: key, sx: e.clientX, sy: e.clientY,
      ox: o ? o.dx : 0, oy: o ? o.dy : 0, moved: false,
    };
    g.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', function(e){
    if (!drag) { return; }
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) <= DRAG_SLOP) { return; }
    if (!drag.moved) { drag.moved = true; drag.g.classList.add('fm-dragging'); }
    // Only once the gesture IS a drag: stops the pointer stream selecting the card's text as it
    // sweeps across it. Deliberately not on pointerdown — see the focus note there.
    e.preventDefault();
    var s = scaleNow();
    setOffset(drag.key, drag.ox + (e.clientX - drag.sx) / s, drag.oy + (e.clientY - drag.sy) / s);
  });

  // A card's thumbnail is an <img>, which the browser will happily start a native drag-and-drop on
  // the moment the pointer moves — that gesture takes over from ours and the card stops following.
  svg.addEventListener('dragstart', function(e){ if (drag) { e.preventDefault(); } });

  function endDrag(){
    if (!drag) { return; }
    drag.g.classList.remove('fm-dragging');
    // A drag that moved must not also fire the card's click (row highlight + log jump) on release.
    suppressClick = drag.moved;
    drag = null;
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  // Capture phase, so this runs before the card's own click handler and before the thumbnail's
  // lightbox binder — a card dragged by its screenshot must not open the screenshot on release.
  svg.addEventListener('click', function(e){
    if (!suppressClick) { return; }
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  /* How far a card has been moved from where the renderer placed it, or null for an untouched one.
     Exposed because SVGGraphicsElement.getBBox() reports an element's OWN user space and does NOT
     include the group transform a moved card carries — anything that locates a card by getBBox
     (the lens's center-on-fault) would otherwise scroll to where the card used to be. */
  window.__fmOffsetOf = function(el){
    var key = el && el.getAttribute ? el.getAttribute('data-key') : null;
    var o = key ? offsets[key] : null;
    return o ? { dx: o.dx, dy: o.dy } : null;
  };

  /* Exposed for the lens's Reset view button: an arrangement the reader built by hand needs one
     deliberate way back to the layout the renderer chose. */
  window.__fmResetNodes = function(){
    Object.keys(offsets).forEach(function(key){
      var n = nodes[key];
      if (n) { n.el.removeAttribute('transform'); }
    });
    // Object.create(null) again, not {} — reset must not hand back the prototype hazard the
    // declaration above avoids.
    offsets = Object.create(null);
    arranged = false;
    svg.querySelectorAll('g.fm-edge').forEach(reroute);
  };
${flowMapTimeLayoutJs()}
})();</script>`;
}
