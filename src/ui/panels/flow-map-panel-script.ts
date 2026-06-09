/**
 * Client script for the flow-map webview panel (extracted to keep flow-map-panel.ts under the line
 * limit). Wires: save button, source `file:line` open, log-line reveal/copy, diagram node →
 * row-highlight + log jump, and TOC links that expand+scroll their section.
 */

/** The full `<script>` block for the panel, nonce-guarded for CSP. */
export function flowMapScript(nonce: string): string {
    return `<script nonce="${nonce}">(function(){
  var v = acquireVsCodeApi();
  function send(type, data){ data = data || {}; data.type = type; v.postMessage(data); }
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
})();</script>`;
}
