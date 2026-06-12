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
    var cpDetailTitle = '';
    /* Project Firebase console URL (#3) — set in renderData from ctx.consoleUrl, forwarded with the
       detail request so the host renders the "View on Firebase" link with localized t() copy. The URL
       is project-level: Play Reporting issue IDs don't map to Firebase per-issue pages. */
    var cpConsoleUrl = '';
    /* The issue whose detail is currently shown, so a late-arriving project-insights panel for a
       different (since-switched) issue is dropped instead of appended to the wrong detail. */
    var cpDetailIssueId = '';

    /* Append the host-rendered "In your project" panel to the detail body once (#2 / 5c). */
    function applyProjectInsights(id, html) {
        if (!cpDetailEl || !html || id !== cpDetailIssueId) return;
        var body = cpDetailEl.querySelector('.cd-body');
        if (!body || body.querySelector('.cd-proj')) return;
        body.insertAdjacentHTML('beforeend', html);
    }

    /* Append the "Seen in your captured logs" panel once (5c-4 local-log correlation). */
    function applyLogCorrelation(id, html) {
        if (!cpDetailEl || !html || id !== cpDetailIssueId) return;
        var body = cpDetailEl.querySelector('.cd-body');
        if (!body || body.querySelector('.cd-log-link')) return;
        body.insertAdjacentHTML('beforeend', html);
    }

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
        var meta = row ? { title: row.dataset.title, subtitle: row.dataset.sub, events: row.dataset.events, users: row.dataset.users, fatal: row.dataset.fatal === '1', fv: row.dataset.fv, lv: row.dataset.lv, kind: row.dataset.kind, state: row.dataset.state } : {};
        cpDetailIssueId = id;
        cpDetailEl.innerHTML = '<div class="cd-loading">' + vt('viewer.crashlytics.detail.loading') + '</div>';
        cpDetailEl.classList.remove('u-hidden');
        if (cpLogWrap) cpLogWrap.classList.add('u-hidden');
        vscodeApi.postMessage({ type: 'fetchCrashlyticsDetail', issueId: id, meta: meta, consoleUrl: cpConsoleUrl });
    }

    function closeIssueDetail() {
        if (cpDetailEl) cpDetailEl.classList.add('u-hidden');
        if (cpLogWrap) cpLogWrap.classList.remove('u-hidden');
    }

    if (cpDetailEl) {
        cpDetailEl.addEventListener('click', function(e) {
            if (e.target.closest('.cd-back')) { closeIssueDetail(); return; }
            if (e.target.closest('.cd-copy')) { vscodeApi.postMessage({ type: 'copyToClipboard', text: cpDetailMarkdown }); return; }
            // Create issue: open a prefilled GitHub new-issue page with the crash Markdown as the body.
            if (e.target.closest('.cd-newissue')) { vscodeApi.postMessage({ type: 'crashlyticsCreateIssue', title: cpDetailTitle, body: cpDetailMarkdown }); return; }
            // View on Firebase: open the project Crashlytics console in the browser (#3).
            var consoleLink = e.target.closest('.cd-console-link');
            if (consoleLink && consoleLink.getAttribute('data-url')) { vscodeApi.postMessage({ type: 'openUrl', url: consoleLink.getAttribute('data-url') }); return; }
            // Related PR/issue links in the "In your project" panel open in the browser (5c-3).
            var projLink = e.target.closest('.cd-proj-link');
            if (projLink && projLink.getAttribute('data-url')) { vscodeApi.postMessage({ type: 'openUrl', url: projLink.getAttribute('data-url') }); return; }
            // "Seen in your logs" match opens that captured session at the matching line (5c-4).
            var logLink = e.target.closest('.cd-log-link');
            if (logLink && logLink.getAttribute('data-uri')) { vscodeApi.postMessage({ type: 'crashlyticsOpenLogLine', uri: logLink.getAttribute('data-uri'), line: Number(logLink.getAttribute('data-line')), col: Number(logLink.getAttribute('data-col')) }); return; }
            // Per-frame copy (#1b): copy just this frame's text. Checked before the frame-open branch
            // (the button sits inside the clickable frame row), so copying never also opens the file.
            var frameCopy = e.target.closest('.cd-frame-copy');
            if (frameCopy) { e.stopPropagation(); vscodeApi.postMessage({ type: 'copyToClipboard', text: frameCopy.getAttribute('data-copy') }); return; }
            // App-only toggle (#1d): hide framework frames/groups via a body class (pure client-side).
            var appOnly = e.target.closest('.cd-apponly');
            if (appOnly) {
                var bodyEl = cpDetailEl.querySelector('.cd-body');
                if (bodyEl) { var on = bodyEl.classList.toggle('cd-appcode-only'); appOnly.setAttribute('aria-pressed', on ? 'true' : 'false'); appOnly.classList.toggle('cd-apponly-on', on); }
                return;
            }
            // Jump to code: an app frame opens the file at its line (UX #1).
            var frame = e.target.closest('.frame-app[data-frame-file]');
            if (frame) { vscodeApi.postMessage({ type: 'crashlyticsOpenFrame', file: frame.getAttribute('data-frame-file'), line: frame.getAttribute('data-frame-line') }); }
        });
    }

    /* ---- Frame context menu (#1c): lightweight right-click popover over a stack frame ---- */
    var cdMenu = null, cdMenuFrame = null;
    function cdEnsureMenu() {
        if (cdMenu && cdMenu.isConnected) return cdMenu;
        cdMenu = document.createElement('div');
        cdMenu.className = 'cd-ctxmenu u-hidden';
        cdMenu.innerHTML =
            '<div class="cd-ctxitem" data-act="copy">' + vt('viewer.crashlytics.frameMenu.copy') + '</div>'
            + '<div class="cd-ctxitem" data-act="copypath">' + vt('viewer.crashlytics.frameMenu.copyPath') + '</div>'
            + '<div class="cd-ctxitem" data-act="open">' + vt('viewer.crashlytics.frameMenu.open') + '</div>'
            + '<div class="cd-ctxitem" data-act="issue">' + vt('viewer.crashlytics.frameMenu.issue') + '</div>';
        document.body.appendChild(cdMenu);
        // stopPropagation so selecting an item does not bubble to the panel's outside-click handler.
        cdMenu.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var it = ev.target.closest('.cd-ctxitem');
            if (it && cdMenuFrame) cdRunFrameAction(it.getAttribute('data-act'), cdMenuFrame);
            cdHideMenu();
        });
        return cdMenu;
    }
    function cdHideMenu() { if (cdMenu) cdMenu.classList.add('u-hidden'); cdMenuFrame = null; }
    function cdFrameText(frame) {
        var btn = frame.querySelector('.cd-frame-copy');
        return btn ? btn.getAttribute('data-copy') : (frame.textContent || '').trim();
    }
    function cdRunFrameAction(act, frame) {
        var file = frame.getAttribute('data-frame-file'), line = frame.getAttribute('data-frame-line'), text = cdFrameText(frame);
        if (act === 'copy') vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        else if (act === 'copypath' && file) vscodeApi.postMessage({ type: 'copyToClipboard', text: file });
        else if (act === 'open' && file) vscodeApi.postMessage({ type: 'crashlyticsOpenFrame', file: file, line: line });
        else if (act === 'issue') vscodeApi.postMessage({ type: 'crashlyticsCreateIssue', title: cpDetailTitle, body: 'Crash frame: ' + text + '\\n\\n' + cpDetailMarkdown });
    }
    if (cpDetailEl) cpDetailEl.addEventListener('contextmenu', function(e) {
        var frame = e.target.closest('.stack-frame');
        if (!frame) return;
        e.preventDefault();
        var menu = cdEnsureMenu();
        cdMenuFrame = frame;
        var hasFile = !!frame.getAttribute('data-frame-file');
        menu.querySelector('[data-act="copypath"]').style.display = hasFile ? '' : 'none';
        menu.querySelector('[data-act="open"]').style.display = hasFile ? '' : 'none';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.remove('u-hidden');
    });
    document.addEventListener('mousedown', function(e) { if (cdMenu && !cdMenu.contains(e.target)) cdHideMenu(); });

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
    var cpRegexOn = false, cpRegexObj = null;
    /* Sort key for the issue list. The API returns issues already ordered by event count desc, so
       'events' reproduces the server order; 'users' re-sorts client-side. Sorting reorders the DOM
       rows (appendChild moves nodes); it is independent of the per-row display filter above. */
    var cpSort = 'events';

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
        var attr = cpSort === 'users' ? 'data-users' : 'data-events';
        var rows = Array.prototype.slice.call(cpIssuesEl.querySelectorAll('.cp-item'));
        rows.sort(function(a, b) { return (Number(b.getAttribute(attr)) || 0) - (Number(a.getAttribute(attr)) || 0); });
        rows.forEach(function(r) { cpIssuesEl.appendChild(r); });
    }

    function cpHas(item, attr, want) { return !want || (item.getAttribute(attr) || '').split(',').indexOf(want) >= 0; }
    function applyCpFilters() {
        if (!cpIssuesEl) return;
        var rows = cpIssuesEl.querySelectorAll('.cp-item');
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var ok = (cpKind === 'all' || r.getAttribute('data-kind') === cpKind)
                && cpSearchMatch(r)
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
        applyCpSort();
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
        var s = document.getElementById('cp-search'); if (s) s.addEventListener('input', function() { cpUpdateSearch(s.value); });
        var rx = document.getElementById('cp-regex');
        if (rx && s) rx.addEventListener('click', function() {
            cpRegexOn = !cpRegexOn;
            rx.classList.toggle('cp-regex-on', cpRegexOn);
            rx.setAttribute('aria-pressed', cpRegexOn ? 'true' : 'false');
            cpUpdateSearch(s.value);
        });
        var ver = document.getElementById('cp-ver'); if (ver) ver.addEventListener('change', function() { cpFVer = ver.value; applyCpFilters(); });
        var dev = document.getElementById('cp-dev'); if (dev) dev.addEventListener('change', function() { cpFDev = dev.value; applyCpFilters(); });
        var os = document.getElementById('cp-os'); if (os) os.addEventListener('change', function() { cpFOs = os.value; applyCpFilters(); });
        var sort = document.getElementById('cp-sort'); if (sort) sort.addEventListener('change', function() { cpSort = sort.value; applyCpSort(); });
        function ensureIndex() { if (cpIndexRequested) return; cpIndexRequested = true; vscodeApi.postMessage({ type: 'fetchCrashlyticsFilterIndex' }); }
        [dev, os].forEach(function(el) { if (el) { el.addEventListener('mousedown', ensureIndex); el.addEventListener('focus', ensureIndex); } });
    })();
`;
}
