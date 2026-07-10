/**
 * Crashlytics panel interaction script: the in-viewer issue detail. Extracted from
 * viewer-crashlytics-panel.ts to keep that file under the line limit; the stack-frame context
 * menu and the sidebar list controls are further splits of this file, inlined below.
 * Returned as a template-literal fragment inlined into the panel's IIFE, so it shares scope
 * (cpIssuesEl, esc, vt, vscodeApi) and its function declarations are visible to the main script.
 *
 * TWO render containers (plan 110, Stage 2). The issue detail used to render only into the
 * full-area #crashlytics-detail, which covers the log. In Trouble Mode a band row now renders
 * it into the side rail instead, beside the feed. cdActiveContainer() is the single place that
 * decides which one is live; cpDetailEl always points at it, so the click handlers, the
 * crashlyticsDetailReady route, and the three async enrichers all follow automatically.
 * That also retires the old KNOWN LIMITATION: a band-opened detail sets cpDetailIssueId through
 * the same path as a list-opened one, so it receives the "In your project" / "Seen in your logs"
 * / device-states panels that gate on it.
 */

import { getCrashlyticsFrameMenuScript } from './viewer-crashlytics-frame-menu-script';
import { getCrashlyticsFiltersScript } from './viewer-crashlytics-filters-script';

/** JS fragment: detail open/close + skeleton + frame annotations + the inlined sub-fragments. */
export function getCrashlyticsInteractionsScript(): string {
    return /* js */ `
    /* ---- In-viewer issue detail (full-area panel flow, or the Trouble Mode rail) ---- */
    var cdFullEl = document.getElementById('crashlytics-detail');
    var cdRailEl = document.getElementById('trouble-detail-crashlytics');
    var cpLogWrap = document.getElementById('log-content-wrapper');
    /* The container the detail is currently rendered into. Never assigned directly —
       cdActiveContainer() is the one writer, so no code path can leave it stale. */
    var cpDetailEl = cdFullEl;
    var cdRailActive = false;
    var cpDetailMarkdown = '';
    var cpDetailTitle = '';
    /* Project Firebase console URL (#3) — set in renderData from ctx.consoleUrl, forwarded with the
       detail request so the host renders the "View on Firebase" link with localized t() copy. The URL
       is project-level: Play Reporting issue IDs don't map to Firebase per-issue pages. */
    var cpConsoleUrl = '';
    /* The issue whose detail is currently shown, so a late-arriving project-insights panel for a
       different (since-switched) issue is dropped instead of appended to the wrong detail. */
    var cpDetailIssueId = '';
    /* The clicked row's meta, kept so the error state's Try again button can re-issue the same
       fetch without the user hunting for the row again. */
    var cpDetailMeta = {};

    function cdActiveContainer(useRail) {
        cdRailActive = !!(useRail && cdRailEl);
        cpDetailEl = cdRailActive ? cdRailEl : cdFullEl;
        return cpDetailEl;
    }

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

    /* Append the foreground/background "Device states" panel once (T3.2). */
    function applyDeviceStates(id, html) {
        if (!cpDetailEl || !html || id !== cpDetailIssueId) return;
        var body = cpDetailEl.querySelector('.cd-body');
        if (!body || body.querySelector('.cd-device-states')) return;
        body.insertAdjacentHTML('beforeend', html);
    }

    /* Informative skeleton (plan 110, Stage 3). The clicked row already carries title,
       subtitle, counts, kind/state and the version range, so the header renders in the
       same frame as the click; only the stack — the one thing that needs the network —
       shimmers. The previous single "Loading issue…" line threw all of that away. */
    function cdSkeletonHtml(m) {
        var sevCls = m.fatal ? 'cd-sev-crash' : (m.kind === 'anr' ? 'cd-sev-anr' : 'cd-sev-nf');
        var ver = (m.fv && m.lv && m.fv !== m.lv) ? (m.fv + ' → ' + m.lv) : (m.lv || m.fv || '');
        var chips = '<span class="cd-skel-chip">' + esc(vt('viewer.troubleCrashlytics.counts', m.events || '0', m.users || '0')) + '</span>';
        if (m.state && m.state !== 'UNKNOWN') chips += '<span class="cd-skel-chip">' + esc(m.state) + '</span>';
        if (ver) chips += '<span class="cd-skel-chip">' + esc(ver) + '</span>';
        return '<div class="cd-header"><span class="cd-title">' + esc(m.title || '') + '</span></div>'
            + '<div class="cd-body"><div class="cd-skel-head"><span class="cd-skel-sev ' + sevCls + '"></span>'
            + '<div class="cd-skel-titles"><div class="cd-skel-sub">' + esc(m.subtitle || '') + '</div>'
            + '<div class="cd-skel-chips">' + chips + '</div></div></div>'
            + '<div class="cd-loading">' + vt('viewer.crashlytics.detail.loading') + '</div>'
            + '<div class="cd-shimmer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>';
    }

    /* One fetch path for both entry points. useRail=true renders beside the feed (Trouble
       Mode band); useRail=false keeps the original behavior of hiding the log under the
       full-area detail (the Crashlytics sidebar panel flow). */
    function cdOpenDetail(id, meta, useRail) {
        var el = cdActiveContainer(useRail);
        if (!el) return;
        cpDetailIssueId = id;
        cpDetailMeta = meta || {};
        el.innerHTML = cdSkeletonHtml(cpDetailMeta);
        if (cdRailActive) {
            if (typeof openTroubleRail === 'function') openTroubleRail('crashlytics');
        } else {
            el.classList.remove('u-hidden');
            if (cpLogWrap) cpLogWrap.classList.add('u-hidden');
        }
        vscodeApi.postMessage({ type: 'fetchCrashlyticsDetail', issueId: id, meta: cpDetailMeta, consoleUrl: cdRailActive ? '' : cpConsoleUrl });
    }

    /* Sidebar list click: highlight the row, harvest its meta, open in the full area. */
    function openIssueDetail(id) {
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
        cdOpenDetail(id, meta, false);
    }

    function closeIssueDetail() {
        if (cdRailActive) {
            cdActiveContainer(false);
            cpDetailIssueId = '';
            if (typeof closeTroubleDetail === 'function') closeTroubleDetail();
            return;
        }
        cpDetailIssueId = '';
        if (cdFullEl) cdFullEl.classList.add('u-hidden');
        if (cpLogWrap) cpLogWrap.classList.remove('u-hidden');
    }

    /* Bridges for scripts outside this IIFE (the Trouble Mode band + rail). Exposing two
       named functions is what lets a band-opened detail run the SAME cdOpenDetail path —
       and therefore set cpDetailIssueId — instead of posting the fetch itself. */
    window.slcOpenCrashlyticsDetailInRail = function(meta) { cdOpenDetail(meta.id, meta, true); };
    window.slcCloseCrashlyticsDetail = function() { closeIssueDetail(); };

    /* Delegated clicks for one detail container; wired to both so the rail behaves
       identically to the full-area panel detail. */
    function cdWireContainer(el) {
        if (!el) return;
        el.addEventListener('click', function(e) {
            if (e.target.closest('.cd-back')) { closeIssueDetail(); return; }
            // Try again after a failed load (plan 110, Stage 3): re-run the same fetch.
            if (e.target.closest('.cd-retry')) { cdOpenDetail(cpDetailIssueId, cpDetailMeta, cdRailActive); return; }
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
                var bodyEl = el.querySelector('.cd-body');
                if (bodyEl) { var on = bodyEl.classList.toggle('cd-appcode-only'); appOnly.setAttribute('aria-pressed', on ? 'true' : 'false'); appOnly.classList.toggle('cd-apponly-on', on); }
                return;
            }
            // Jump to code: an app frame opens the file at its line (UX #1).
            var frame = e.target.closest('.frame-app[data-frame-file]');
            if (frame) { vscodeApi.postMessage({ type: 'crashlyticsOpenFrame', file: frame.getAttribute('data-frame-file'), line: frame.getAttribute('data-frame-line') }); }
        });
    }

${getCrashlyticsFrameMenuScript()}

    [cdFullEl, cdRailEl].forEach(function(el) { cdWireContainer(el); cdWireFrameMenu(el); });

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

    /* ---- Sidebar list controls (#5): search, tabs, dropdowns, sort, archived ---- */
${getCrashlyticsFiltersScript()}
`;
}
