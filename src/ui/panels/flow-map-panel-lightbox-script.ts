/**
 * Client script for the screenshot lightbox. Any capture in the panel — a diagram card's thumbnail
 * (`image.fm-shot` inside the SVG) or a gallery figure (`img.shot-img`) — opens a full-size overlay
 * with its capture facts and a reveal-in-log action.
 *
 * Kept as its own nonce-guarded `<script>` (like the zoom and replay scripts) so each diagram feature
 * owns its state machine and no single file drifts over the line budget. Clicks on a thumbnail
 * `stopPropagation()` because the enclosing `.fm-node` group has its own click (row highlight + log
 * jump) and dblclick (detail popup) handlers — without that, opening a screenshot would also scroll
 * the log viewer out from under the reader.
 */

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
}

/** The full `<script>` block wiring the screenshot lightbox, nonce-guarded for CSP. */
export function flowMapLightboxScript(nonce: string, labels: LightboxLabels): string {
    return `<script nonce="${nonce}">(function(){
  var L = ${JSON.stringify(labels)};
  var overlay = null;
  var opener = null;

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
    var img = document.createElement('img');
    img.className = 'fms-img';
    img.src = src;
    img.alt = el.getAttribute('data-shot-screen') || L.title;
    var grid = document.createElement('div');
    grid.className = 'fms-grid';
    addRow(grid, L.screen, el.getAttribute('data-shot-screen'));
    addRow(grid, L.captured, el.getAttribute('data-shot-clock'));
    addRow(grid, L.trigger, el.getAttribute('data-shot-trigger'));
    addLogRow(grid, parseInt(el.getAttribute('data-shot-line') || '0', 10));
    card.appendChild(closeBtn);
    card.appendChild(img);
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

  document.querySelectorAll('img.shot-img').forEach(function(img){
    bind(img, function(){ return img.src; });
  });
  // SVG <image> exposes its data URI through the href/xlink:href attribute, not .src.
  document.querySelectorAll('image.fm-shot').forEach(function(im){
    bind(im, function(){ return im.getAttribute('href') || im.getAttribute('xlink:href') || ''; });
  });

  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && overlay) { close(); } });
})();</script>`;
}
