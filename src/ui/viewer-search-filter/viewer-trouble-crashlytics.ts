/**
 * Trouble Mode Crashlytics band — webview side.
 *
 * Renders the host's cached-issue rows (troubleCrashlyticsRows) as a compact band above
 * the feed. A row click opens the EXISTING in-viewer Crashlytics detail — but in the
 * Trouble Mode side rail, beside the log, not over it (plan 110, Stages 1–2).
 *
 * It reaches the detail through `window.slcOpenCrashlyticsDetailInRail`, the bridge the
 * Crashlytics panel's IIFE exposes. That matters beyond layout: routing through the
 * panel's own open path is what sets its private `cpDetailIssueId`, so a band-opened
 * detail now receives the async enrichment panels ("In your project", "Seen in your
 * logs", device states) that gate on it. Before plan 110 this script posted the fetch
 * itself and those panels were silently dropped.
 *
 * `requestTroubleCrashlytics` is fired when Trouble Mode turns on; the host reads the
 * on-disk cache only (no network), so a cold cache yields no rows and the band stays
 * hidden. Visibility is also gated by CSS to Trouble-Mode-active, so it can never
 * linger over a normal feed. Because the rows are a cache read, the band states how
 * old they are — an issue list with no age is a claim the extension cannot support.
 */

/** Embedded webview JavaScript for the Trouble Mode Crashlytics band. */
export function getTroubleCrashlyticsScript(): string {
    return /* javascript */ `
/* Rows shown inline. The band is a triage cue, not the issue backlog: past five rows it
   costs the feed more height than it returns, and the full list is one click away. */
var TROUBLE_CRASHLYTICS_BAND_ROWS = 5;

/* Local escapers — issue titles are remote data and can contain HTML metacharacters.
   Namespaced to avoid colliding with other scripts in the shared page scope. */
function tcxEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function tcxAttr(s) {
    return tcxEsc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function requestTroubleCrashlytics() {
    if (typeof vscodeApi === 'undefined') { return; }
    vscodeApi.postMessage({ type: 'requestTroubleCrashlytics' });
}

/* One row: a severity dot, the issue title, and the events/users counts. Every field
   the detail's meta needs rides along in data-* so the click needs no lookup — and so
   the loading skeleton can draw the full header before the network answers. */
function troubleCrashlyticsRowHtml(r) {
    var sev = r.fatal ? 'tcx-crash' : (r.kind === 'anr' ? 'tcx-anr' : 'tcx-nonfatal');
    var counts = vt('viewer.troubleCrashlytics.counts', r.events, r.users);
    return '<button type="button" class="tcx-row"'
        + ' data-id="' + tcxAttr(r.id) + '" data-title="' + tcxAttr(r.title) + '" data-sub="' + tcxAttr(r.subtitle) + '"'
        + ' data-events="' + tcxAttr(r.events) + '" data-users="' + tcxAttr(r.users) + '" data-fatal="' + (r.fatal ? '1' : '0') + '"'
        + ' data-kind="' + tcxAttr(r.kind || '') + '" data-state="' + tcxAttr(r.state || '') + '"'
        + ' data-fv="' + tcxAttr(r.fv || '') + '" data-lv="' + tcxAttr(r.lv || '') + '">'
        + '<span class="tcx-sev ' + sev + '" aria-hidden="true"></span>'
        + '<span class="tcx-title">' + tcxEsc(r.title) + '</span>'
        + '<span class="tcx-counts">' + tcxEsc(counts) + '</span>'
        + '</button>';
}

/* Time-only for a cache written today; date + time once it is older. A bare "9:17 AM" beside
   an 18:00 log was read as the log's own time (field report), but the value is the Firebase
   Crashlytics CLOUD cache's write instant, unrelated to the log. Showing the date once it is
   not today's removes that ambiguity; the freshTitle tooltip names the source in full. */
function troubleCrashlyticsFreshStamp(cachedAt) {
    var when = new Date(cachedAt);
    var now = new Date();
    var sameDay = when.getFullYear() === now.getFullYear()
        && when.getMonth() === now.getMonth()
        && when.getDate() === now.getDate();
    return sameDay ? when.toLocaleTimeString() : when.toLocaleString();
}

/* Cache age. The host stamps cachedAt when the background watcher writes issues.json;
   an absolute stamp beats a relative one here because the band is not re-rendered as it
   ages, so "5m ago" would quietly become a lie. */
function renderTroubleCrashlyticsFreshness(cachedAt) {
    var el = document.getElementById('trouble-crashlytics-fresh');
    if (!el) { return; }
    if (typeof cachedAt !== 'number' || !(cachedAt > 0)) {
        el.textContent = vt('viewer.troubleCrashlytics.updatedUnknown');
        return;
    }
    el.textContent = vt('viewer.troubleCrashlytics.updated', troubleCrashlyticsFreshStamp(cachedAt));
}

/* Collapse the band to its head — the title and cache age stay (a collapsed band still
   answers "how fresh are these issues"), only the rows and the "All N" link drop, hidden by
   CSS. Mirrors the severity chart's toggle; no re-render either way since the rows are kept. */
var troubleCrashlyticsCollapsed = false;
function toggleTroubleCrashlyticsCollapsed() {
    var band = document.getElementById('trouble-crashlytics');
    var btn = document.getElementById('trouble-crashlytics-toggle');
    if (!band) { return; }
    troubleCrashlyticsCollapsed = !troubleCrashlyticsCollapsed;
    band.classList.toggle('tcx-collapsed', troubleCrashlyticsCollapsed);
    if (btn) { btn.setAttribute('aria-expanded', troubleCrashlyticsCollapsed ? 'false' : 'true'); }
}

/* "All N issues" opens the full Crashlytics panel via its icon-bar button — the panel
   owns its own open/close and outside-click bookkeeping, so clicking its affordance is
   the only way to enter it without duplicating that state here. */
function renderTroubleCrashlyticsMore(total, shown) {
    var more = document.getElementById('trouble-crashlytics-more');
    if (!more) { return; }
    if (!(total > shown)) { more.classList.add('u-hidden'); more.innerHTML = ''; return; }
    more.innerHTML = '<button type="button" class="tcx-more-btn">' + tcxEsc(vt('viewer.troubleCrashlytics.allIssues', total)) + '</button>';
    more.classList.remove('u-hidden');
}

/* Fill the band; hide it when there are no cached issues (cold cache). */
function renderTroubleCrashlyticsRows(msg) {
    if (typeof document === 'undefined') { return; }
    var band = document.getElementById('trouble-crashlytics');
    var rowsEl = document.getElementById('trouble-crashlytics-rows');
    if (!band || !rowsEl) { return; }
    var rows = (msg && msg.rows) || [];
    if (!rows.length) { rowsEl.innerHTML = ''; band.classList.add('u-hidden'); return; }
    var shown = rows.slice(0, TROUBLE_CRASHLYTICS_BAND_ROWS);
    var html = '';
    for (var i = 0; i < shown.length; i++) { html += troubleCrashlyticsRowHtml(shown[i]); }
    rowsEl.innerHTML = html;
    renderTroubleCrashlyticsFreshness(msg && msg.cachedAt);
    renderTroubleCrashlyticsMore((msg && msg.total) || rows.length, shown.length);
    band.classList.remove('u-hidden');
}

/* Wayfinding: the open issue's row stays highlighted until the rail closes, so the band
   answers "which of these am I reading". Cleared from closeTroubleDetail (single close
   path for both rail modes). */
function markTroubleCrashlyticsSelection(id) {
    var rowsEl = document.getElementById('trouble-crashlytics-rows');
    if (!rowsEl) { return; }
    var rows = rowsEl.querySelectorAll('.tcx-row');
    for (var i = 0; i < rows.length; i++) { rows[i].classList.toggle('tcx-selected', rows[i].dataset.id === id); }
}

function clearTroubleCrashlyticsSelection() {
    if (typeof document === 'undefined') { return; }
    var rowsEl = document.getElementById('trouble-crashlytics-rows');
    if (!rowsEl) { return; }
    var rows = rowsEl.querySelectorAll('.tcx-selected');
    for (var i = 0; i < rows.length; i++) { rows[i].classList.remove('tcx-selected'); }
}

/* Open the clicked issue in the side rail. Guarded on the bridge: the Crashlytics panel
   script defines it, and in the VM test harness (no panel markup) it is absent. */
function openTroubleCrashlyticsDetail(meta) {
    if (typeof window === 'undefined' || typeof window.slcOpenCrashlyticsDetailInRail !== 'function') { return; }
    markTroubleCrashlyticsSelection(meta.id);
    window.slcOpenCrashlyticsDetailInRail(meta);
}

(function() {
    if (typeof document === 'undefined') { return; }
    /* The caret AND the title toggle the collapse — the title is the larger, more obvious
       hit target. The cache-age span is deliberately NOT wired: it carries its own tooltip. */
    var cxToggle = document.getElementById('trouble-crashlytics-toggle');
    if (cxToggle) { cxToggle.addEventListener('click', toggleTroubleCrashlyticsCollapsed); }
    var cxTitle = document.getElementById('trouble-crashlytics-title');
    if (cxTitle) { cxTitle.addEventListener('click', toggleTroubleCrashlyticsCollapsed); }
    var rowsEl = document.getElementById('trouble-crashlytics-rows');
    if (rowsEl) {
        rowsEl.addEventListener('click', function(e) {
            var row = e.target.closest ? e.target.closest('.tcx-row') : null;
            if (!row) { return; }
            var d = row.dataset;
            openTroubleCrashlyticsDetail({
                id: d.id, title: d.title, subtitle: d.sub, events: d.events, users: d.users,
                fatal: d.fatal === '1', kind: d.kind, state: d.state, fv: d.fv, lv: d.lv,
            });
        });
    }
    var more = document.getElementById('trouble-crashlytics-more');
    if (more) {
        more.addEventListener('click', function(e) {
            if (!e.target.closest('.tcx-more-btn')) { return; }
            var ib = document.getElementById('ib-crashlytics');
            if (ib) { ib.click(); }
        });
    }
})();
`;
}
