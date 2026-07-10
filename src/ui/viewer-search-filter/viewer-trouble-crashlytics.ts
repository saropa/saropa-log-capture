/**
 * Trouble Mode Crashlytics band (plan Trouble Mode dashboard, Stage 5) — webview side.
 *
 * Renders the host's cached-issue rows (troubleCrashlyticsRows) as a compact band
 * above the feed, and turns a row click into the EXISTING in-viewer Crashlytics
 * detail overlay by posting the same `fetchCrashlyticsDetail` message the crashlytics
 * panel sends (the host reply fills #crashlytics-detail; its own .cd-back closes it).
 * No editor-tab dashboard is created (fenced, 2026-05-24 pivot).
 *
 * `requestTroubleCrashlytics` is fired when Trouble Mode turns on; the host reads the
 * on-disk cache only (no network), so a cold cache yields no rows and the band stays
 * hidden. Visibility is also gated by CSS to Trouble-Mode-active, so it can never
 * linger over a normal feed.
 */

/** Embedded webview JavaScript for the Trouble Mode Crashlytics band. */
export function getTroubleCrashlyticsScript(): string {
    return /* javascript */ `
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
   the detail overlay's meta needs rides along in data-* so the click needs no lookup. */
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

/* Fill the band; hide it when there are no cached issues (cold cache). */
function renderTroubleCrashlyticsRows(msg) {
    if (typeof document === 'undefined') { return; }
    var band = document.getElementById('trouble-crashlytics');
    var rowsEl = document.getElementById('trouble-crashlytics-rows');
    if (!band || !rowsEl) { return; }
    var rows = (msg && msg.rows) || [];
    if (!rows.length) { rowsEl.innerHTML = ''; band.classList.add('u-hidden'); return; }
    var html = '';
    for (var i = 0; i < rows.length; i++) { html += troubleCrashlyticsRowHtml(rows[i]); }
    rowsEl.innerHTML = html;
    band.classList.remove('u-hidden');
}

/* Reuse the shipped in-viewer Crashlytics detail overlay: same reveal + fetch the
   crashlytics panel does (openIssueDetail), so the host reply renders identically and
   the overlay's own back button closes it. consoleUrl is empty here (the cache path
   has no project URL); the detail degrades to no deep-link, never a broken one. */
function openTroubleCrashlyticsDetail(meta) {
    if (typeof document === 'undefined' || typeof vscodeApi === 'undefined') { return; }
    var detailEl = document.getElementById('crashlytics-detail');
    var logWrap = document.getElementById('log-content-wrapper');
    if (!detailEl) { return; }
    detailEl.innerHTML = '<div class="cd-loading">' + vt('viewer.crashlytics.detail.loading') + '</div>';
    detailEl.classList.remove('u-hidden');
    if (logWrap) { logWrap.classList.add('u-hidden'); }
    vscodeApi.postMessage({ type: 'fetchCrashlyticsDetail', issueId: meta.id, meta: meta, consoleUrl: '' });
}

(function() {
    if (typeof document === 'undefined') { return; }
    var rowsEl = document.getElementById('trouble-crashlytics-rows');
    if (!rowsEl) { return; }
    rowsEl.addEventListener('click', function(e) {
        var row = e.target.closest ? e.target.closest('.tcx-row') : null;
        if (!row) { return; }
        var d = row.dataset;
        openTroubleCrashlyticsDetail({
            id: d.id, title: d.title, subtitle: d.sub, events: d.events, users: d.users,
            fatal: d.fatal === '1', kind: d.kind, state: d.state, fv: d.fv, lv: d.lv,
        });
    });
})();
`;
}
