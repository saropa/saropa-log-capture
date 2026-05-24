/**
 * Crashlytics panel interaction script: in-viewer issue detail + compact sidebar filters.
 * Extracted from viewer-crashlytics-panel.ts to keep that file under the line limit.
 * Returned as a template-literal fragment inlined into the panel's IIFE, so it shares scope
 * (cpIssuesEl, esc, vt, vscodeApi) and its function declarations are visible to the main script.
 */

/** JS fragment: detail open/close + frame-context annotations + the sidebar filter logic. */
export function getCrashlyticsInteractionsScript(): string {
    return /* js */ `
    /* ---- In-viewer issue detail (fills the log area beside the sidebar) ---- */
    var cpDetailEl = document.getElementById('crashlytics-detail');
    var cpLogWrap = document.getElementById('log-content-wrapper');
    var cpDetailMarkdown = '';

    function openIssueDetail(id) {
        if (!cpDetailEl) return;
        var row = null;
        if (cpIssuesEl) {
            var items = cpIssuesEl.querySelectorAll('.cp-item');
            for (var i = 0; i < items.length; i++) {
                var sel = items[i].dataset.issueId === id;
                items[i].classList.toggle('cp-selected', sel);
                if (sel) row = items[i];
            }
        }
        var meta = row ? { title: row.dataset.title, subtitle: row.dataset.sub, events: row.dataset.events, users: row.dataset.users, fatal: row.dataset.fatal === '1', fv: row.dataset.fv, lv: row.dataset.lv } : {};
        cpDetailEl.innerHTML = '<div class="cd-loading">' + vt('viewer.crashlytics.detail.loading') + '</div>';
        cpDetailEl.classList.remove('u-hidden');
        if (cpLogWrap) cpLogWrap.classList.add('u-hidden');
        vscodeApi.postMessage({ type: 'fetchCrashlyticsDetail', issueId: id, meta: meta });
    }

    function closeIssueDetail() {
        if (cpDetailEl) cpDetailEl.classList.add('u-hidden');
        if (cpLogWrap) cpLogWrap.classList.remove('u-hidden');
    }

    if (cpDetailEl) {
        cpDetailEl.addEventListener('click', function(e) {
            if (e.target.closest('.cd-back')) { closeIssueDetail(); return; }
            if (e.target.closest('.cd-copy')) { vscodeApi.postMessage({ type: 'copyToClipboard', text: cpDetailMarkdown }); return; }
            // Jump to code: an app frame opens the file at its line (UX #1).
            var frame = e.target.closest('.frame-app[data-frame-file]');
            if (frame) { vscodeApi.postMessage({ type: 'crashlyticsOpenFrame', file: frame.getAttribute('data-frame-file'), line: frame.getAttribute('data-frame-line') }); }
        });
    }

    /* Append source line + git blame under matching app frames (streamed after detail). */
    function applyFrameContexts(contexts) {
        if (!cpDetailEl) return;
        var frames = cpDetailEl.querySelectorAll('.stack-frame');
        contexts.forEach(function(ctx) {
            for (var i = 0; i < frames.length; i++) {
                if (frames[i].getAttribute('data-frame-file') !== ctx.file || frames[i].getAttribute('data-frame-line') !== String(ctx.line)) continue;
                if (frames[i].querySelector('.cd-frame-ctx')) break;
                var html = '';
                if (ctx.code) html += '<code class="cd-frame-code">' + esc(ctx.code) + '</code>';
                if (ctx.blame) html += '<span class="cd-frame-blame">' + esc(ctx.blame) + '</span>';
                var ann = document.createElement('div'); ann.className = 'cd-frame-ctx'; ann.innerHTML = html;
                frames[i].appendChild(ann); break;
            }
        });
    }

    /* ---- Sidebar filters (#5): compact, client-side over the #cp-issues rows ---- */
    var cpFilterbar = document.getElementById('cp-filterbar');
    var cpKind = 'all', cpSearchText = '', cpFVer = '', cpFDev = '', cpFOs = '', cpIndexRequested = false;

    function cpHas(item, attr, want) { return !want || (item.getAttribute(attr) || '').split(',').indexOf(want) >= 0; }
    function applyCpFilters() {
        if (!cpIssuesEl) return;
        var rows = cpIssuesEl.querySelectorAll('.cp-item');
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var ok = (cpKind === 'all' || r.getAttribute('data-kind') === cpKind)
                && (!cpSearchText || (r.getAttribute('data-search') || '').indexOf(cpSearchText) >= 0)
                && cpHas(r, 'data-versions', cpFVer) && cpHas(r, 'data-devices', cpFDev) && cpHas(r, 'data-os', cpFOs);
            r.style.display = ok ? '' : 'none';
        }
    }
    function cpUnion(rows, attr) {
        var set = {};
        for (var i = 0; i < rows.length; i++) { var v = rows[i].getAttribute(attr); if (v) { v.split(',').forEach(function(x) { if (x) set[x] = true; }); } }
        return Object.keys(set).sort();
    }
    /* Keep the host-rendered first <option> (the "Ver"/"Dev"/"OS" abbreviation) and append values. */
    function cpFillSelect(el, values) {
        if (!el) return;
        var cur = el.value;
        var first = el.options[0] ? el.options[0].outerHTML : '<option value=""></option>';
        el.innerHTML = first + values.map(function(v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
        el.value = cur;
    }
    function showCpFilters() {
        if (!cpFilterbar) return;
        cpFilterbar.style.display = '';
        // Rows were rebuilt, so device/OS annotations are gone — allow a re-fetch on next dropdown use.
        cpIndexRequested = false;
        var rows = cpIssuesEl ? cpIssuesEl.querySelectorAll('.cp-item') : [];
        cpFillSelect(document.getElementById('cp-ver'), cpUnion(rows, 'data-versions'));
        applyCpFilters();
    }
    function applyCpFilterIndex(index) {
        if (!cpIssuesEl || !index) return;
        var rows = cpIssuesEl.querySelectorAll('.cp-item');
        for (var i = 0; i < rows.length; i++) {
            var sid = (rows[i].getAttribute('data-issue-id') || '').split('/').pop();
            rows[i].setAttribute('data-devices', ((index.devicesByIssue || {})[sid] || []).join(','));
            rows[i].setAttribute('data-os', ((index.osByIssue || {})[sid] || []).join(','));
        }
        cpFillSelect(document.getElementById('cp-dev'), cpUnion(rows, 'data-devices'));
        cpFillSelect(document.getElementById('cp-os'), cpUnion(rows, 'data-os'));
    }
    (function wireCpFilters() {
        var tabs = cpFilterbar ? cpFilterbar.querySelector('.cp-tabs') : null;
        if (tabs) tabs.addEventListener('click', function(e) {
            var b = e.target.closest('.cp-tab'); if (!b) return;
            tabs.querySelectorAll('.cp-tab-sel').forEach(function(t) { t.classList.remove('cp-tab-sel'); });
            b.classList.add('cp-tab-sel'); cpKind = b.getAttribute('data-kind'); applyCpFilters();
        });
        var s = document.getElementById('cp-search'); if (s) s.addEventListener('input', function() { cpSearchText = s.value.toLowerCase(); applyCpFilters(); });
        var ver = document.getElementById('cp-ver'); if (ver) ver.addEventListener('change', function() { cpFVer = ver.value; applyCpFilters(); });
        var dev = document.getElementById('cp-dev'); if (dev) dev.addEventListener('change', function() { cpFDev = dev.value; applyCpFilters(); });
        var os = document.getElementById('cp-os'); if (os) os.addEventListener('change', function() { cpFOs = os.value; applyCpFilters(); });
        function ensureIndex() { if (cpIndexRequested) return; cpIndexRequested = true; vscodeApi.postMessage({ type: 'fetchCrashlyticsFilterIndex' }); }
        [dev, os].forEach(function(el) { if (el) { el.addEventListener('mousedown', ensureIndex); el.addEventListener('focus', ensureIndex); } });
    })();
`;
}
