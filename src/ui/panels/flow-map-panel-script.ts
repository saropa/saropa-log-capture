/**
 * Client script for the flow-map webview panel (extracted to keep flow-map-panel.ts under the line
 * limit). Wires: save button, source `file:line` open, log-line reveal/copy, diagram node →
 * row-highlight + log jump, and TOC links that expand+scroll their section. The diagram lens
 * (zoom/pan/pop-out/node-detail popup) lives in flow-map-panel-zoom-script.ts and reuses the
 * `window.__fmSend` bridge exposed here (acquireVsCodeApi may be acquired only once per webview).
 */

/** The full `<script>` block for the panel, nonce-guarded for CSP. */
export function flowMapScript(nonce: string): string {
    return `<script nonce="${nonce}">(function(){
  var v = acquireVsCodeApi();
  function send(type, data){ data = data || {}; data.type = type; v.postMessage(data); }
  // Expose the post bridge so sibling scripts (the diagram lens) can message without re-acquiring
  // the (single-use) vscode API.
  window.__fmSend = send;
  function onActivate(el, fn){
    el.addEventListener('click', fn);
    el.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }
  function escapeSel(k){ return (window.CSS && CSS.escape) ? CSS.escape(k) : k.replace(/["\\\\]/g, '\\\\$&'); }

  var save = document.getElementById('save-md');
  if (save) save.addEventListener('click', function(){ send('saveMarkdown'); });
  var refresh = document.getElementById('refresh-fm');
  if (refresh) refresh.addEventListener('click', function(){ send('refreshFlowMap'); });
  var showLog = document.getElementById('showlog-fm');
  if (showLog) showLog.addEventListener('click', function(){ send('showFlowLog'); });
  var logPath = document.querySelector('.logpath');
  if (logPath) onActivate(logPath, function(){ send('showFlowLog'); });

  document.querySelectorAll('.src').forEach(function(el){
    onActivate(el, function(){ send('openFlowMapSource', { file: el.getAttribute('data-file'), line: parseInt(el.getAttribute('data-line') || '1', 10) }); });
  });
  document.querySelectorAll('.loglink').forEach(function(el){
    onActivate(el, function(){ send('revealLogLine', { line: parseInt(el.getAttribute('data-line') || '0', 10) }); });
  });
  document.querySelectorAll('.logcopy').forEach(function(el){
    onActivate(el, function(){ send('copyLogLine', { line: parseInt(el.getAttribute('data-line') || '0', 10) }); });
  });
  // Stat pills trace back to a representative log line — reveal it on click.
  document.querySelectorAll('.pill-link').forEach(function(el){
    onActivate(el, function(){ var ln = parseInt(el.getAttribute('data-line') || '0', 10); if (ln) send('revealLogLine', { line: ln }); });
  });
  // Activity-chart points jump the log to the first line in that time bin.
  document.querySelectorAll('.ac-link').forEach(function(el){
    onActivate(el, function(){ var ln = parseInt(el.getAttribute('data-line') || '0', 10); if (ln) send('revealLogLine', { line: ln }); });
  });

  // Clicking a diagram node highlights its table row and jumps the log to where it was entered.
  document.querySelectorAll('.fm-node').forEach(function(g){
    onActivate(g, function(){
      var k = g.getAttribute('data-rowkey');
      if (k) {
        document.querySelectorAll('tr.fm-hl').forEach(function(r){ r.classList.remove('fm-hl'); });
        var row = document.querySelector('tr[data-key="' + escapeSel(k) + '"]');
        if (row) { row.classList.add('fm-hl'); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
      var ll = g.getAttribute('data-logline');
      if (ll) send('revealLogLine', { line: parseInt(ll, 10) });
    });
  });

  // TOC: expand the target section (in case it was collapsed) then scroll to it.
  document.querySelectorAll('.toc a').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var el = document.getElementById(a.getAttribute('data-target'));
      if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // Executive-summary copy button: send the rendered paragraph's plain text to the host clipboard.
  var copyBtn = document.querySelector('.copy-narrative');
  if (copyBtn) copyBtn.addEventListener('click', function(){
    var p = document.getElementById('narrative-text');
    var text = p ? (p.textContent || '').trim() : '';
    if (text) send('copyText', { text: text });
  });

  // --- Column resize: drag the divider to trade diagram width for detail width. ---
  var row = document.querySelector('.report-row');
  var diagram = document.querySelector('.diagram-col');
  var resizer = document.querySelector('.col-resize');
  var st0 = (v.getState && v.getState()) || {};
  if (diagram && st0.diagramW) diagram.style.setProperty('--diagram-w', st0.diagramW + 'px');
  if (resizer && row && diagram) {
    var dragging = false;
    resizer.addEventListener('pointerdown', function(e){
      dragging = true; resizer.classList.add('dragging');
      resizer.setPointerCapture(e.pointerId); e.preventDefault();
    });
    resizer.addEventListener('pointermove', function(e){
      if (!dragging) return;
      // Width = pointer offset from the diagram's left edge. The only clamp is a 20px floor on
      // each side so the gripper never disappears under a zero-width column; otherwise the user
      // sets any ratio and the columns crop their content (overflow:hidden in CSS) rather than
      // refusing to shrink below the widest cell.
      var left = diagram.getBoundingClientRect().left;
      var resizerW = resizer.getBoundingClientRect().width;
      var w = Math.max(20, e.clientX - left);
      var max = row.getBoundingClientRect().width - resizerW - 20;
      if (max > 20) w = Math.min(w, max);
      diagram.style.setProperty('--diagram-w', Math.round(w) + 'px');
    });
    function endDrag(){
      if (!dragging) return;
      dragging = false; resizer.classList.remove('dragging');
      var st = (v.getState && v.getState()) || {};
      st.diagramW = parseInt(diagram.style.getPropertyValue('--diagram-w'), 10) || st.diagramW;
      if (v.setState) v.setState(st);
    }
    resizer.addEventListener('pointerup', endDrag);
    resizer.addEventListener('pointercancel', endDrag);
  }

  // --- Column auto-collapse: a column whose sections are all closed shrinks to its headers. ---
  function updateColCollapse(){
    var cols = document.querySelectorAll('.report-row > .diagram-col, .report-row > .detail-col');
    cols.forEach(function(col){
      var secs = col.querySelectorAll('details.sec');
      var anyOpen = false;
      secs.forEach(function(d){ if (d.open) anyOpen = true; });
      col.classList.toggle('col-collapsed', secs.length > 0 && !anyOpen);
    });
    // With either side fully collapsed there is nothing to resize against — neutralize the divider.
    var anyCollapsed = document.querySelector('.report-row > .col-collapsed');
    if (row) row.classList.toggle('no-resize', !!anyCollapsed);
  }
  document.querySelectorAll('details.sec').forEach(function(d){ d.addEventListener('toggle', updateColCollapse); });
  updateColCollapse();

  // --- Sortable tables (Issue Report): click a header to sort; aria-sort drives the chevron. ---
  function cellVal(tr, idx, numeric){
    var cell = tr.children[idx];
    var txt = cell ? (cell.textContent || '').trim() : '';
    if (!numeric) return txt.toLowerCase();
    var m = /^(\\d{2}):(\\d{2}):(\\d{2})$/.exec(txt);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
    var f = parseFloat(txt.replace(/[^0-9.-]/g, ''));
    return isNaN(f) ? -Infinity : f;
  }
  function sortBy(table, th, idx){
    var asc = th.getAttribute('aria-sort') !== 'ascending';
    table.querySelectorAll('thead th').forEach(function(o){ o.removeAttribute('aria-sort'); });
    th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
    var numeric = th.classList.contains('num');
    var tbody = table.querySelector('tbody');
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function(a, b){
      var x = cellVal(a, idx, numeric), y = cellVal(b, idx, numeric);
      return x < y ? (asc ? -1 : 1) : x > y ? (asc ? 1 : -1) : 0;
    });
    rows.forEach(function(r){ tbody.appendChild(r); });
  }
  document.querySelectorAll('table.sortable').forEach(function(table){
    table.querySelectorAll('thead th').forEach(function(th, idx){
      th.addEventListener('click', function(){ sortBy(table, th, idx); });
    });
  });
})();</script>`;
}
