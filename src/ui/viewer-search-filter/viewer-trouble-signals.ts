/**
 * Trouble Mode Signals band — webview side.
 *
 * Replaces the removed Crashlytics band with data that is actually about the log on screen:
 * the current log's recurring signals (errors, warnings, performance patterns) — the same
 * `signalsInThisLog` list the Signal panel's "Signals in this log" section shows, sourced from
 * THIS capture, not the cloud.
 *
 * It reuses the Signal panel's data path (requestSignalData → signalData message →
 * signalDataCache, owned by viewer-signal-panel-script-part-a/c). This band only reads that
 * cache and renders a compact top-N view; the panel's handler calls renderTroubleSignalsBand
 * whenever fresh data arrives. A row click jumps the feed to the signal's first occurrence
 * (scrollToLineNumber, the same jump the panel's rows use).
 *
 * Visibility is gated by CSS to Trouble-Mode-active AND by this script hiding the band when
 * there are no signals, so it can never linger over a normal feed or show an empty box.
 */

/** Embedded webview JavaScript for the Trouble Mode Signals band. */
export function getTroubleSignalsScript(): string {
    return /* javascript */ `
/* Rows shown inline. The band is a triage cue, not the full signal list: past five it costs the
   feed more height than it returns, and the whole list is one click away in the Signal panel. */
var TROUBLE_SIGNALS_BAND_ROWS = 5;

/* Ask the host for signal data when entering Trouble Mode. Idempotent — the Signal panel may
   have asked already; the host answer refreshes signalDataCache and calls back here. */
function requestTroubleSignals() {
    if (typeof vscodeApi === 'undefined') { return; }
    vscodeApi.postMessage({ type: 'requestSignalData' });
}

/* One row: the signal's label and its occurrence count. data-line carries the 0-based index of
   the signal's first log line (when it has one) so a click can jump the feed there. */
function troubleSignalRowHtml(s) {
    var count = (typeof s.totalOccurrences === 'number' && s.totalOccurrences > 0) ? s.totalOccurrences : 1;
    var jumpable = s.lineIndices && s.lineIndices.length > 0;
    var lineAttr = jumpable ? ' data-line="' + s.lineIndices[0] + '"' : '';
    var cls = 'tsg-row' + (jumpable ? ' tsg-jumpable' : '');
    return '<button type="button" class="' + cls + '"' + lineAttr + ' title="' + tsgAttr(s.label) + '">'
        + '<span class="tsg-label">' + tsgEsc(s.label) + '</span>'
        + '<span class="tsg-count">' + tsgEsc(vt('viewer.troubleSignals.count', count)) + '</span>'
        + '</button>';
}

/* Local escapers — signal labels can contain HTML metacharacters. Namespaced to avoid
   colliding with other scripts in the shared page scope. */
function tsgEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function tsgAttr(s) {
    return tsgEsc(s).replace(/"/g, '&quot;');
}

/* Fill the band from signalDataCache.signalsInThisLog (owned by the Signal panel script; absent
   in the VM test harness). Hides the band when there are no signals for the current log. */
function renderTroubleSignalsBand() {
    if (typeof document === 'undefined') { return; }
    var band = document.getElementById('trouble-signals');
    var rowsEl = document.getElementById('trouble-signals-rows');
    if (!band || !rowsEl) { return; }
    var all = (typeof signalDataCache !== 'undefined' && signalDataCache && signalDataCache.signalsInThisLog) || [];
    if (!all.length) { rowsEl.innerHTML = ''; band.classList.add('u-hidden'); return; }
    var shown = all.slice(0, TROUBLE_SIGNALS_BAND_ROWS);
    var html = '';
    for (var i = 0; i < shown.length; i++) { html += troubleSignalRowHtml(shown[i]); }
    rowsEl.innerHTML = html;
    var countEl = document.getElementById('trouble-signals-count');
    if (countEl) { countEl.textContent = vt('viewer.troubleSignals.total', all.length); }
    renderTroubleSignalsMore(all.length, shown.length);
    band.classList.remove('u-hidden');
}

/* "All N" opens the full Signal panel via its icon-bar button — the panel owns its own
   open/close, so clicking its affordance is the only way in without duplicating that state. */
function renderTroubleSignalsMore(total, shown) {
    var more = document.getElementById('trouble-signals-more');
    if (!more) { return; }
    if (!(total > shown)) { more.classList.add('u-hidden'); more.innerHTML = ''; return; }
    more.innerHTML = '<button type="button" class="tsg-more-btn">' + tsgEsc(vt('viewer.troubleSignals.all', total)) + '</button>';
    more.classList.remove('u-hidden');
}

/* Collapse the band to its head (the count stays; rows drop). Mirrors the severity chart's
   toggle; no re-render either way since the rows are kept in the DOM. */
var troubleSignalsCollapsed = false;
function toggleTroubleSignalsCollapsed() {
    var band = document.getElementById('trouble-signals');
    var btn = document.getElementById('trouble-signals-toggle');
    if (!band) { return; }
    troubleSignalsCollapsed = !troubleSignalsCollapsed;
    band.classList.toggle('tsg-collapsed', troubleSignalsCollapsed);
    if (btn) { btn.setAttribute('aria-expanded', troubleSignalsCollapsed ? 'false' : 'true'); }
}

(function() {
    if (typeof document === 'undefined') { return; }
    /* Caret and title both toggle the collapse (the title is the larger target). */
    var toggle = document.getElementById('trouble-signals-toggle');
    if (toggle) { toggle.addEventListener('click', toggleTroubleSignalsCollapsed); }
    var title = document.getElementById('trouble-signals-title');
    if (title) { title.addEventListener('click', toggleTroubleSignalsCollapsed); }
    var rowsEl = document.getElementById('trouble-signals-rows');
    if (rowsEl) {
        /* Delegated: a jumpable row carries the 0-based first-line index; scrollToLineNumber
           (viewer-goto-line.ts, 1-based) jumps the feed there. Guarded. */
        rowsEl.addEventListener('click', function(e) {
            var row = e.target.closest ? e.target.closest('.tsg-jumpable') : null;
            if (!row) { return; }
            var idx = parseInt(row.getAttribute('data-line') || '', 10);
            if (!isNaN(idx) && idx >= 0 && typeof scrollToLineNumber === 'function') { scrollToLineNumber(idx + 1); }
        });
    }
    var more = document.getElementById('trouble-signals-more');
    if (more) {
        more.addEventListener('click', function(e) {
            if (!e.target.closest('.tsg-more-btn')) { return; }
            var ib = document.getElementById('ib-signal');
            if (ib) { ib.click(); }
        });
    }
})();
`;
}
