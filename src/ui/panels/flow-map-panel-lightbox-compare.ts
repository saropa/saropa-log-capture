/**
 * Side-by-side compare for the screenshot lightbox. Interpolated INSIDE the lightbox IIFE (like the
 * zoom module), so it shares that scope and adds no globals.
 *
 * A screen captured several times raises exactly one question — what changed between them — and the
 * count pill on a diagram card is where the reader meets that question. Compare answers it by
 * putting two captures of the SAME screen side by side, aligned at the same height, with their
 * clocks under them.
 *
 * Same screen, not the whole gallery: comparing Home against Settings answers nothing. The set comes
 * from the `data-shot-siblings` attribute the renderer already computed per screen.
 *
 * Deliberately NOT a pixel-difference overlay. Reading the two PNGs would mean drawing them to a
 * canvas, and webview image URLs are a different origin from the webview document, so `getImageData`
 * would taint and throw. A real difference metric belongs host-side where the bytes are readable —
 * see the capture-dedup discussion — not bolted onto a viewer with a canvas that cannot read pixels.
 */

/** JS statements (no wrapper) implementing lightbox compare, injected into the lightbox IIFE. */
export function flowMapLightboxCompareJs(): string {
    return /* javascript */ `
  /* The screen's capture set for the open lightbox, and which of them the right pane shows. */
  var cmpSet = null, cmpRight = 0, cmpOn = false;

  /* Parse the sibling set off a clicked capture. Returns null when there is nothing to compare —
     a lone capture, a malformed attribute, or a set that lost its shape — so every caller can treat
     "no compare available" as one condition instead of three. */
  function cmpParse(el){
    var raw = el.getAttribute('data-shot-siblings');
    if (!raw) { return null; }
    try {
      var set = JSON.parse(raw);
      return (Array.isArray(set) && set.length > 1) ? set : null;
    } catch (err) { return null; }
  }

  /* One pane: the capture plus its clock. Panes share a height so the two screens line up row for
     row — an unaligned pair makes every element look changed. */
  function cmpPane(shot, label){
    var pane = document.createElement('div');
    pane.className = 'fms-cmp-pane';
    var img = document.createElement('img');
    img.className = 'fms-cmp-img';
    img.src = shot.src;
    img.alt = label;
    // Same failure statement the thumbnails make: a sibling can be deleted while the report is open,
    // and a compare pane silently showing a broken-image glyph would read as "this screen changed
    // completely" — the exact wrong conclusion for the one view whose job is spotting differences.
    img.addEventListener('error', function(){
      img.classList.add('fm-shot-missing');
      img.title = L.unavailable;
    });
    var cap = document.createElement('div');
    cap.className = 'fms-cmp-cap';
    cap.textContent = label;
    pane.appendChild(img);
    pane.appendChild(cap);
    return pane;
  }

  /* Caption for one capture in the set: clock plus trigger, the same wording the gallery uses. */
  function cmpLabel(shot){ return shot.clock + ' · ' + shot.trigger; }

  /* Redraw both panes. The LEFT pane is always the capture the reader opened (their anchor); the
     right walks the set, skipping the left so a pane is never compared with itself. */
  function cmpRender(host, current){
    host.textContent = '';
    host.appendChild(cmpPane(current, cmpLabel(current)));
    host.appendChild(cmpPane(cmpSet[cmpRight], cmpLabel(cmpSet[cmpRight])));
  }

  function cmpStep(host, current, delta){
    if (!cmpSet) { return; }
    var n = cmpSet.length;
    // A BOUNDED scan, never "skip until different". Captures are grouped by screen and nothing
    // dedups them by file, so every entry in a set can legitimately carry the same src — and a loop
    // whose only exit is "found a different one" would then spin forever and hang the panel. One lap
    // maximum; if nothing else qualifies, land where the lap ended and show the pair as it is.
    var next = cmpRight;
    for (var i = 0; i < n; i++) {
      next = (next + delta + n) % n;
      if (cmpSet[next].src !== current.src) { break; }
    }
    cmpRight = next;
    cmpRender(host, current);
  }

  /* The compare strip: a toggle, and (once on) prev/next through the screen's other captures.
     Returns null when the capture has no siblings, so the card simply omits the control rather than
     showing one that would do nothing. */
  function cmpBar(card, stage, current, el){
    cmpSet = cmpParse(el);
    cmpRight = 0;
    cmpOn = false;
    if (!cmpSet) { return null; }
    var host = document.createElement('div');
    host.className = 'fms-cmp fms-off';
    var bar = document.createElement('div');
    bar.className = 'fms-cmp-bar';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fms-cmp-btn';
    toggle.textContent = L.compare;
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'fms-cmp-btn fms-off';
    prev.textContent = '‹';
    prev.title = L.comparePrev;
    prev.setAttribute('aria-label', L.comparePrev);
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'fms-cmp-btn fms-off';
    next.textContent = '›';
    next.title = L.compareNext;
    next.setAttribute('aria-label', L.compareNext);
    toggle.addEventListener('click', function(){
      cmpOn = !cmpOn;
      // The single view and the compare view are alternatives, not layers: showing both would put
      // the same capture on screen twice and halve the room each copy gets.
      stage.classList.toggle('fms-off', cmpOn);
      host.classList.toggle('fms-off', !cmpOn);
      prev.classList.toggle('fms-off', !cmpOn);
      next.classList.toggle('fms-off', !cmpOn);
      toggle.classList.toggle('fms-cmp-on', cmpOn);
      if (cmpOn) { cmpStep(host, current, 1); }
    });
    prev.addEventListener('click', function(){ cmpStep(host, current, -1); });
    next.addEventListener('click', function(){ cmpStep(host, current, 1); });
    bar.appendChild(toggle);
    bar.appendChild(prev);
    bar.appendChild(next);
    card.appendChild(host);
    return bar;
  }
`;
}
