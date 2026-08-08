/**
 * Prev/next navigation for the screenshot lightbox. Split from `flow-map-panel-lightbox-script.ts`
 * for the same reason zoom and compare were: the text below is interpolated INSIDE that script's
 * IIFE, so it shares its scope (`L`, `open`, `overlay`) and adds no globals of its own.
 *
 * WHAT COUNTS AS "NEXT" is the surface the reader opened from, not the session's whole capture set.
 * The panel shows captures on three surfaces with three different denominators — the gallery lists
 * every capture, a diagram card shows one per screen, and the timeline/dwell thumbnails show one per
 * bin/row — so walking a single flat list would jump the reader between surfaces and make the
 * lightbox's own "Capture 3 of 7" counter disagree with where ‹ and › actually go. Navigation stays
 * within the class the opener belongs to, which is exactly the set the reader can see behind the
 * overlay.
 *
 * Captures whose PNG failed to load are excluded: the error handler strips their click target, so
 * stepping onto one would open an empty stage with no way to tell why.
 */

/** JS statements (no wrapper) implementing lightbox prev/next, injected into the lightbox IIFE. */
export function flowMapLightboxNavJs(): string {
    return /* javascript */ `
  /* The three capture surfaces, each its own navigation set. Order is irrelevant — an element
     belongs to exactly one of these classes. */
  var NAV_CLASSES = ['shot-img', 'fm-shot', 'fm-mini-shot'];
  var navList = [], navIndex = -1, navigating = false;

  function navSetFor(el){
    for (var i = 0; i < NAV_CLASSES.length; i++) {
      if (!el.classList.contains(NAV_CLASSES[i])) { continue; }
      return Array.prototype.slice.call(
        document.querySelectorAll('img.' + NAV_CLASSES[i] + ':not(.fm-shot-missing)'));
    }
    return [el];
  }

  /* Rebuilt on every open (not cached): the failed-load handler removes captures from the set as
     their fetches fail, which can happen after the first lightbox has already been opened. */
  function navReset(el){
    navList = navSetFor(el);
    navIndex = navList.indexOf(el);
  }

  function navGo(delta){
    var next = navList[navIndex + delta];
    if (!next) { return; }
    // Suppresses close()'s focus restore for the intermediate teardown: without it, focus lands on
    // the outgoing thumbnail for a frame before the new overlay claims it, which screen readers
    // announce as leaving the dialog and re-entering it.
    // try/finally, not two plain statements: a throw inside open() would otherwise leave the flag
    // set for the life of the panel, and every later close would silently stop restoring focus.
    navigating = true;
    try { open(next, next.src); } finally { navigating = false; }
  }

  /* Prev · position · next. Returns null for a lone capture — a disabled pair of arrows around
     "Capture 1 of 1" is three controls saying there is nothing to do. */
  function navBar(countText){
    if (navList.length < 2) { return null; }
    var bar = document.createElement('div');
    bar.className = 'fms-nav';
    var prev = navBtn('\\u2039', L.prev, -1);
    var next = navBtn('\\u203a', L.next, 1);
    var label = document.createElement('span');
    label.className = 'fms-count';
    // The per-surface counter when the capture carries one, else this element's own position — a
    // diagram card knows "2 of 3 on this screen", a timeline thumbnail knows nothing but where it
    // sits in the strip.
    label.textContent = countText || ((navIndex + 1) + ' / ' + navList.length);
    bar.appendChild(prev);
    bar.appendChild(label);
    bar.appendChild(next);
    return bar;
  }

  function navBtn(glyph, title, delta){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fms-nav-btn';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.textContent = glyph;
    // Disabled rather than wrapped: a wrap turns "next" into a silent jump back to the first
    // capture, and there is no cue in the dialog that the set even ended.
    b.disabled = !navList[navIndex + delta];
    b.addEventListener('click', function(){ navGo(delta); });
    return b;
  }

  /* Arrow keys, with two exclusions.

     A focused form control keeps them: the zoom slider is a range input inside this same dialog and
     arrows are its own increment/decrement.

     Compare keeps them too. Stepping to another capture rebuilds the whole dialog, which drops the
     comparison the reader just set up — the pane, the chosen session, the aligned pair — and gives
     no reason why. Compare has its own prev/next over the same screen's captures, which is what
     arrows should mean while it is open. NOT excluded by focused tag name: the dialog's close
     button takes focus the moment it opens, so excluding BUTTON would disable arrow navigation by
     default in every other case. */
  function navKey(e){
    if (!overlay || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) { return; }
    var tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { return; }
    if (overlay.querySelector('.fms-cmp:not(.fms-off)')) { return; }
    e.preventDefault();
    navGo(e.key === 'ArrowLeft' ? -1 : 1);
  }
`;
}
