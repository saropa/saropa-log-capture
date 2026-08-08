/**
 * The by-time arrangement: lay the cards out along a wall-clock axis instead of by graph depth, so
 * horizontal distance becomes elapsed time. A screen the user sat on for four minutes ends up four
 * minutes wide, and the diagram and the activity timeline become one reading rather than two.
 *
 * Injected INSIDE the drag script's IIFE (like the lightbox's zoom/nav/compare modules), so it uses
 * that script's `nodes`, `setOffset`, `boxOf` and reset path rather than a second layout engine —
 * an arranged card is just a card with an offset, and dragging it afterwards works unchanged
 * because every edge re-routes through the same code either way.
 *
 * WHY IT FITS THE EXISTING CANVAS. The time axis is normalized into the width the renderer already
 * chose, not extended past it. The lens sizes the SVG element from a static viewBox, so a card
 * placed beyond that viewBox is simply clipped with nothing to scroll to — silently losing the last
 * screen of the session, which is usually the interesting one. Normalizing keeps every card
 * reachable, and proportional spacing is preserved either way: only the scale changes.
 *
 * WHY LANES. Two screens entered a second apart map to nearly the same x. Stacking them in the
 * first lane whose previous card has cleared makes near-simultaneous cards read as a column at one
 * moment, which is what they are — rather than one card drawn on top of another.
 *
 * Cards with no entry time (the synthetic launch node, screens that were never walked) have no
 * position on a time axis. They are parked in rows below the arrangement instead of being left
 * where the depth layout put them, which would drop them on top of timed cards.
 */

/** JS statements (no wrapper) implementing the by-time arrangement, injected into the drag IIFE. */
export function flowMapTimeLayoutJs(): string {
    return /* javascript */ `
  /* Vertical gap between lanes, and between the timed block and the untimed rows below it. */
  var LANE_GAP = 26;
  /* Left/right inset for the time axis, matching the renderer's own canvas margin. */
  var TIME_MARGIN = 26;

  /* Every card that carries an entry time, earliest first. */
  function timedCards(){
    var out = [];
    Object.keys(nodes).forEach(function(key){
      if (nodes[key].ts !== null) { out.push({ key: key, n: nodes[key] }); }
    });
    return out.sort(function(a, b){ return a.n.ts - b.n.ts; });
  }

  /* The x a timestamp maps to, normalized into the canvas the renderer already sized. */
  function timeScale(cards){
    var first = cards[0].n.ts;
    var span = cards[cards.length - 1].n.ts - first;
    var widest = 0;
    cards.forEach(function(c){ if (c.n.w > widest) { widest = c.n.w; } });
    var usable = BASE_W - TIME_MARGIN * 2 - widest;
    return function(ts){
      // Two degenerate inputs collapse to the left edge, where the lanes below do the separating.
      // A zero span is every card entered in the same millisecond — no axis to lay out along. A
      // non-positive usable width is a canvas narrower than one card plus its margins, where
      // spreading cards would only push them off the edge; stacking keeps every one reachable.
      return TIME_MARGIN + (span > 0 && usable > 0 ? ((ts - first) / span) * usable : 0);
    };
  }

  /* The first lane whose last card has cleared this x, opening a new one when none has. */
  function pickLane(lanes, x){
    for (var i = 0; i < lanes.length; i++) {
      if (lanes[i] <= x) { return i; }
    }
    lanes.push(0);
    return lanes.length - 1;
  }

  /* Lane tops, derived from the tallest card so a lane can hold any of them without overlap. */
  function laneTop(lane, tallest){
    return TIME_MARGIN + lane * (tallest + LANE_GAP);
  }

  function arrangeTimed(cards){
    var xOf = timeScale(cards);
    var tallest = 0;
    cards.forEach(function(c){ if (c.n.h > tallest) { tallest = c.n.h; } });
    var lanes = [];          // lane index -> x the lane is free from
    var bottom = 0;
    cards.forEach(function(c){
      var x = xOf(c.n.ts);
      var lane = pickLane(lanes, x);
      var y = laneTop(lane, tallest);
      lanes[lane] = x + c.n.w + LANE_GAP;
      // setOffset takes a DELTA from the card's laid-out position, not an absolute point.
      setOffset(c.key, x - c.n.x, y - c.n.y);
      if (y + c.n.h > bottom) { bottom = y + c.n.h; }
    });
    return bottom;
  }

  /* Untimed cards beneath the arrangement, in the order the renderer placed them. They are shown
     rather than hidden: a screen the log never timestamped is still part of the map, and hiding it
     would make the diagram disagree with itself between modes.

     Wrapped at the canvas edge for the same reason the time axis is normalized into it — the lens
     sizes the SVG from a static viewBox, so a card past that edge is clipped with nothing to
     scroll to. An unbounded row would silently drop screens off the right of the report. */
  function arrangeUntimed(top){
    var x = TIME_MARGIN;
    var y = top;
    var rowH = 0;
    Object.keys(nodes).forEach(function(key){
      var n = nodes[key];
      if (n.ts !== null) { return; }
      // Never wrap the FIRST card of a row: a card wider than the canvas must land somewhere
      // rather than push every later card down a row each.
      if (x > TIME_MARGIN && x + n.w > BASE_W - TIME_MARGIN) {
        x = TIME_MARGIN;
        y += rowH + LANE_GAP;
        rowH = 0;
      }
      setOffset(key, x - n.x, y - n.y);
      x += n.w + LANE_GAP;
      if (n.h > rowH) { rowH = n.h; }
    });
  }

  /* Toggle the arrangement. Returns whether the diagram is now arranged by time, so the toolbar can
     light its button — the control is a mode, and a mode with no visible state is a guess.

     Turning the mode OFF drops every offset, including any card the reader nudged by hand while it
     was on. That is what a mode toggle means here: "off" is the renderer's layout, not the
     renderer's layout plus whatever survived. Reset view behaves identically, for the same reason. */
  window.__fmArrangeByTime = function(){
    if (arranged) {
      window.__fmResetNodes();
      arranged = false;
      return false;
    }
    var cards = timedCards();
    // Nothing carries a time: there is no axis to lay out along, so leave the depth layout alone
    // rather than stacking every card at the left margin and calling it a timeline.
    if (cards.length === 0) { return false; }
    arrangeUntimed(arrangeTimed(cards) + LANE_GAP);
    arranged = true;
    return true;
  };
`;
}
