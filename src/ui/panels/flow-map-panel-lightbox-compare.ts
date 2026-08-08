/**
 * Side-by-side compare for the screenshot lightbox. Interpolated INSIDE the lightbox IIFE (like the
 * zoom module), so it shares that scope and adds no globals.
 *
 * A screen captured several times raises exactly one question — what changed between them — and the
 * count pill on a diagram card is where the reader meets that question. Compare answers it by
 * putting two captures of the SAME screen side by side, aligned at the same height, with their
 * clocks beneath.
 *
 * Two sources for the right-hand pane:
 *
 * - **This session**, read from the `#fm-shot-sets` island the renderer emits once per document
 *   (the elements themselves carry only a screen key and an index — see `shotSetAttrs`).
 * - **Another session**, fetched on demand. "Did this screen regress since yesterday's build" is the
 *   older and more useful question, and it is the same screen-key join, run against another log.
 *
 * Same screen either way: comparing Home against Settings answers nothing.
 *
 * Deliberately NOT a pixel-difference overlay. Reading the two PNGs would mean drawing them to a
 * canvas, and webview image URLs are a different origin from the webview document, so `getImageData`
 * would taint and throw. A real difference metric belongs host-side where the bytes are readable.
 */

/** One other session offered in the compare picker. */
export interface CompareSessionRef {
    readonly logFsPath: string;
    readonly label: string;
}

/** JS statements (no wrapper) implementing lightbox compare, injected into the lightbox IIFE. */
export function flowMapLightboxCompareJs(sessions: readonly CompareSessionRef[]): string {
    return /* javascript */ `
  /* Other sessions with captures, resolved host-side at render (the webview cannot read the log
     directory). Empty when this is the only session, which is what hides the picker. */
  var CMP_SESSIONS = ${JSON.stringify(sessions)};
  /* The open lightbox's compare state. cmpSet is the RIGHT pane's candidate list, which starts as
     this session's set and is replaced wholesale when another session is chosen. */
  var cmpSet = null, cmpSelf = -1, cmpRight = 0, cmpHost = null, cmpKey = '';

  /* Read the per-document island. Parsed on each lightbox open rather than cached: the sets are
     small (bounded by the report's capture cap) and a cache would be a second source of truth for
     something the DOM already holds — stale the moment anything re-renders the body. Returns {}
     (never null) so a document with no multi-capture screen has one shape, not two. */
  function cmpAllSets(){
    var island = document.getElementById('fm-shot-sets');
    if (!island) { return {}; }
    try { return JSON.parse(island.getAttribute('data-sets') || '{}'); }
    catch (err) { return {}; }
  }

  /* This screen's captures for a clicked element, or null when there is nothing to compare. */
  function cmpLookup(el){
    var key = el.getAttribute('data-shot-screen-key');
    if (!key) { return null; }
    var set = cmpAllSets()[key];
    return (set && set.length > 1) ? { key: key, set: set } : null;
  }

  /* One pane: the capture plus its caption. Panes share a height so the two screens line up row for
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

  function cmpLabel(shot){ return shot.clock + ' · ' + shot.trigger; }

  /* Redraw both panes. LEFT is always the capture the reader opened — their anchor. */
  function cmpRender(current){
    if (!cmpHost || !cmpSet || !cmpSet.length) { return; }
    cmpHost.textContent = '';
    cmpHost.appendChild(cmpPane(current, cmpLabel(current)));
    var other = cmpSet[cmpRight];
    cmpHost.appendChild(cmpPane(other, cmpLabel(other) + (other.session ? ' · ' + other.session : '')));
  }

  /* Walk the candidate list. A BOUNDED scan, never "skip until different": the only entry to skip is
     the reader's own capture (by INDEX — two captures of a screen can legitimately share a src, so
     comparing URLs would either loop forever or refuse to move). One lap maximum. */
  function cmpStep(current, delta){
    if (!cmpSet || cmpSet.length === 0) { return; }
    var n = cmpSet.length;
    var next = cmpRight;
    for (var i = 0; i < n; i++) {
      next = (next + delta + n) % n;
      if (next !== cmpSelf) { break; }
    }
    cmpRight = next;
    cmpRender(current);
  }

  /* Replace the right-hand candidates with another session's captures of this screen. cmpSelf goes
     to -1 because no entry in that list is the reader's own capture. An empty reply keeps the
     current list rather than blanking the view — no silent dead end. */
  function cmpUseSession(shots, label, current){
    if (!shots || !shots.length) { return false; }
    for (var i = 0; i < shots.length; i++) { shots[i].session = label; }
    cmpSet = shots;
    cmpSelf = -1;
    cmpRight = 0;
    cmpRender(current);
    return true;
  }

  /* The session picker: this session, plus every other session that has captures. Rendered only when
     the host found other sessions, so a first-ever log shows no dead control. */
  function cmpSessionPicker(local, current, status){
    if (!CMP_SESSIONS.length) { return null; }
    var pick = document.createElement('select');
    pick.className = 'fms-cmp-pick';
    pick.title = L.compareSession;
    pick.setAttribute('aria-label', L.compareSession);
    var here = document.createElement('option');
    here.value = '';
    here.textContent = L.compareThisSession;
    pick.appendChild(here);
    for (var i = 0; i < CMP_SESSIONS.length; i++) {
      var opt = document.createElement('option');
      opt.value = CMP_SESSIONS[i].logFsPath;
      opt.textContent = CMP_SESSIONS[i].label;
      pick.appendChild(opt);
    }
    pick.addEventListener('change', function(){
      if (!pick.value) {
        cmpSet = local.set; cmpSelf = local.self; cmpRight = 0;
        // Abandon any in-flight request. Without this, a reply that was already on its way when the
        // reader came back to this session would land afterwards and silently replace the panes they
        // just chose — an unasked-for change with no visible cause.
        cmpPending = null;
        status.textContent = '';
        cmpStep(current, 1);
        return;
      }
      // No silent async: the reply is a round trip through the host (it reads and parses that log),
      // so the strip says it is working and says so again if that session has no capture of this
      // screen — an unchanged view with no message would read as a broken control.
      status.textContent = L.compareLoading;
      cmpPending = { logFsPath: pick.value, screenKey: cmpKey, current: current, status: status };
      if (window.__fmSend) { window.__fmSend('compareSessionShots', { logFsPath: pick.value, screenKey: cmpKey }); }
    });
    return pick;
  }

  /* The in-flight session request, so a reply that arrives after the lightbox moved on is dropped. */
  var cmpPending = null;

  /* Host reply with another session's captures of a screen. */
  function cmpApplyShots(msg){
    if (!cmpPending || !msg) { return; }
    if (msg.logFsPath !== cmpPending.logFsPath || msg.screenKey !== cmpPending.screenKey) { return; }
    var label = msg.label || '';
    var ok = cmpUseSession(msg.shots, label, cmpPending.current);
    cmpPending.status.textContent = ok ? '' : L.compareNoMatch;
    cmpPending = null;
  }

  /* The compare strip: a toggle, prev/next, and (when other sessions exist) the session picker.
     Returns null when the capture has no siblings AND no other session to compare against, so the
     card omits a control that would do nothing. */
  function cmpBar(card, stage, current, el){
    var found = cmpLookup(el);
    cmpKey = el.getAttribute('data-shot-screen-key') || '';
    cmpPending = null;
    cmpHost = null;
    // A lone capture is still comparable ACROSS sessions — that is the whole point of the picker —
    // so the bar appears whenever there is a screen key and somewhere to look.
    if (!found && !(cmpKey && CMP_SESSIONS.length)) { cmpSet = null; return null; }
    var local = found ? { set: found.set, self: parseInt(el.getAttribute('data-shot-sib') || '0', 10) }
      : { set: [], self: -1 };
    cmpSet = local.set;
    cmpSelf = local.self;
    cmpRight = 0;
    cmpHost = document.createElement('div');
    cmpHost.className = 'fms-cmp fms-off';
    card.appendChild(cmpHost);
    return cmpBarControls(cmpHost, stage, current, local);
  }

  /* The strip's buttons, split out so cmpBar stays inside the function-length budget. */
  function cmpBarControls(host, stage, current, local){
    var bar = document.createElement('div');
    bar.className = 'fms-cmp-bar';
    var status = document.createElement('span');
    status.className = 'fms-cmp-status';
    var toggle = cmpButton(L.compare, '');
    var prev = cmpButton('‹', L.comparePrev);
    var next = cmpButton('›', L.compareNext);
    var pick = cmpSessionPicker(local, current, status);
    var extras = [prev, next];
    if (pick) { extras.push(pick); }
    for (var i = 0; i < extras.length; i++) { extras[i].classList.add('fms-off'); }
    toggle.addEventListener('click', function(){
      var on = host.classList.contains('fms-off');
      // The single view and the compare view are alternatives, not layers: showing both would put
      // the same capture on screen twice and halve the room each copy gets.
      stage.classList.toggle('fms-off', on);
      host.classList.toggle('fms-off', !on);
      for (var j = 0; j < extras.length; j++) { extras[j].classList.toggle('fms-off', !on); }
      toggle.classList.toggle('fms-cmp-on', on);
      if (on) { cmpStep(current, 1); }
    });
    prev.addEventListener('click', function(){ cmpStep(current, -1); });
    next.addEventListener('click', function(){ cmpStep(current, 1); });
    bar.appendChild(toggle);
    for (var k = 0; k < extras.length; k++) { bar.appendChild(extras[k]); }
    bar.appendChild(status);
    return bar;
  }

  function cmpButton(text, title){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fms-cmp-btn';
    b.textContent = text;
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    return b;
  }
`;
}
