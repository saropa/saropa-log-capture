/**
 * Crashlytics sidebar list controls — webview fragment: search (plain or regex), kind tabs,
 * version / release-date / device / OS dropdowns, sort, and the archived toggle, plus the
 * host-streamed trend sparklines and the lazily fetched device/OS filter index.
 *
 * Extracted from viewer-crashlytics-interactions-script.ts when plan 110 Stage 2 gave the
 * issue detail a SECOND render container (the Trouble Mode side rail), pushing that file
 * over the 300-line limit. Nothing here changed in the move.
 *
 * Inlined into the Crashlytics panel's IIFE, so it shares that scope (cpIssuesEl, esc,
 * vscodeApi) and its function declarations stay visible to the panel's main script, which
 * calls showCpFilters / applyCpTrends / applyCpFilterIndex.
 */

/** JS fragment: the compact, client-side filter/sort controls over the #cp-issues rows. */
export function getCrashlyticsFiltersScript(): string {
    return /* js */ `
    var cpFilterbar = document.getElementById('cp-filterbar');
    var cpKind = 'all', cpSearchText = '', cpFVer = '', cpFRel = '', cpFDev = '', cpFOs = '', cpIndexRequested = false;
    var cpRegexOn = false, cpRegexObj = null;
    /* Sort key for the issue list. The API returns issues already ordered by event count desc, so
       'events' reproduces the server order; 'users' re-sorts client-side. Sorting reorders the DOM
       rows (appendChild moves nodes); it is independent of the per-row display filter above. */
    var cpSort = 'events';
    /* When false (default), locally-archived issues are hidden; the "Show archived" toggle reveals them. */
    var cpShowArchived = false;

    /* Recompile the search term when the text or the regex toggle changes. In regex mode an invalid
       pattern is non-fatal: cpRegexObj stays null, the input shows the invalid outline, and the
       search clause matches everything so the list does not blank out mid-typing. */
    function cpUpdateSearch(raw) {
        var input = document.getElementById('cp-search');
        if (cpRegexOn && raw) {
            try { cpRegexObj = new RegExp(raw, 'i'); if (input) input.classList.remove('cp-search-invalid'); }
            catch (e) { cpRegexObj = null; if (input) input.classList.add('cp-search-invalid'); }
            cpSearchText = '';
        } else {
            cpRegexObj = null; cpSearchText = raw.toLowerCase();
            if (input) input.classList.remove('cp-search-invalid');
        }
        applyCpFilters();
    }
    function cpSearchMatch(r) {
        var hay = r.getAttribute('data-search') || '';
        if (cpRegexOn) { return !cpRegexObj || cpRegexObj.test(hay); }
        return !cpSearchText || hay.indexOf(cpSearchText) >= 0;
    }

    /* Reorder the issue rows by the chosen metric (descending). appendChild moves existing nodes, so
       this just rearranges; it never rebuilds rows or touches their filter display state. */
    function applyCpSort() {
        if (!cpIssuesEl) return;
        var rows = Array.prototype.slice.call(cpIssuesEl.querySelectorAll('.cp-item'));
        // Release-date sort: newest derived date first; issues with no date sort to the bottom.
        // ISO YYYY-MM-DD strings compare correctly with localeCompare, so no Date parsing is needed.
        if (cpSort === 'reldate') {
            rows.sort(function(a, b) { return cpRowMaxDate(b).localeCompare(cpRowMaxDate(a)); });
        } else {
            var attr = cpSort === 'users' ? 'data-users' : 'data-events';
            rows.sort(function(a, b) { return (Number(b.getAttribute(attr)) || 0) - (Number(a.getAttribute(attr)) || 0); });
        }
        rows.forEach(function(r) { cpIssuesEl.appendChild(r); });
    }
    /* The latest derived release date on a row, or '' when the versionCode is not date-encoded. */
    function cpRowMaxDate(r) {
        var vals = (r.getAttribute('data-reldates') || '').split(',').filter(Boolean);
        return vals.length ? vals.sort()[vals.length - 1] : '';
    }

    function cpHas(item, attr, want) { return !want || (item.getAttribute(attr) || '').split(',').indexOf(want) >= 0; }
    function applyCpFilters() {
        if (!cpIssuesEl) return;
        var rows = cpIssuesEl.querySelectorAll('.cp-item');
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var archivedOk = cpShowArchived || r.getAttribute('data-archived') !== '1';
            var ok = archivedOk
                && (cpKind === 'all' || r.getAttribute('data-kind') === cpKind)
                && cpSearchMatch(r)
                && cpHas(r, 'data-versions', cpFVer) && cpHas(r, 'data-reldates', cpFRel)
                && cpHas(r, 'data-devices', cpFDev) && cpHas(r, 'data-os', cpFOs);
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
        // Release-date dropdown: newest first (reverse the ascending union) so recent releases are on top.
        cpFillSelect(document.getElementById('cp-reldate'), cpUnion(rows, 'data-reldates').reverse());
        applyCpSort();
        applyCpFilters();
    }
    /* Inject the host-rendered trend sparkline SVG into each row by short issue id (5c / T3.1). */
    function applyCpTrends(map) {
        if (!cpIssuesEl || !map) return;
        var rows = cpIssuesEl.querySelectorAll('.cp-item');
        for (var i = 0; i < rows.length; i++) {
            var sid = (rows[i].getAttribute('data-issue-id') || '').split('/').pop();
            var svg = map[sid];
            if (!svg) continue;
            var slot = rows[i].querySelector('.cp-trend');
            if (slot) slot.innerHTML = svg;
        }
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
        var s = document.getElementById('cp-search'); if (s) s.addEventListener('input', function() { cpUpdateSearch(s.value); });
        var rx = document.getElementById('cp-regex');
        if (rx && s) rx.addEventListener('click', function() {
            cpRegexOn = !cpRegexOn;
            rx.classList.toggle('cp-regex-on', cpRegexOn);
            rx.setAttribute('aria-pressed', cpRegexOn ? 'true' : 'false');
            cpUpdateSearch(s.value);
        });
        var ver = document.getElementById('cp-ver'); if (ver) ver.addEventListener('change', function() { cpFVer = ver.value; applyCpFilters(); });
        var rel = document.getElementById('cp-reldate'); if (rel) rel.addEventListener('change', function() { cpFRel = rel.value; applyCpFilters(); });
        var dev = document.getElementById('cp-dev'); if (dev) dev.addEventListener('change', function() { cpFDev = dev.value; applyCpFilters(); });
        var os = document.getElementById('cp-os'); if (os) os.addEventListener('change', function() { cpFOs = os.value; applyCpFilters(); });
        var sort = document.getElementById('cp-sort'); if (sort) sort.addEventListener('change', function() { cpSort = sort.value; applyCpSort(); });
        var showArch = document.getElementById('cp-show-archived');
        if (showArch) showArch.addEventListener('click', function() {
            cpShowArchived = !cpShowArchived;
            showArch.classList.toggle('cp-regex-on', cpShowArchived);
            showArch.setAttribute('aria-pressed', cpShowArchived ? 'true' : 'false');
            applyCpFilters();
        });
        function ensureIndex() { if (cpIndexRequested) return; cpIndexRequested = true; vscodeApi.postMessage({ type: 'fetchCrashlyticsFilterIndex' }); }
        [dev, os].forEach(function(el) { if (el) { el.addEventListener('mousedown', ensureIndex); el.addEventListener('focus', ensureIndex); } });
    })();
`;
}
