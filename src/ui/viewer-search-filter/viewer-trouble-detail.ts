/**
 * Trouble Mode side rail (plan 110, Stage 1) — webview side.
 *
 * Owns the rail as a SURFACE, not just one report: turning a feed-row selection into
 * an `openTroubleDetail` request to the host (openTroubleDetailForItem, called from
 * the viewport click handler while Trouble Mode is active), rendering the host's
 * `troubleDetailReady` reply into the rail (renderTroubleDetail), opening the rail in
 * either mode (openTroubleRail — the Crashlytics band calls it with 'crashlytics'),
 * and closing it (close button + Escape + leaving Trouble Mode).
 *
 * WHY the width class is computed here in JS rather than by a CSS container query:
 * #log-content-wrapper hosts absolutely positioned children (minimap, jump buttons,
 * goto-line, replay bar). Giving it `container-type: inline-size` would make it a
 * containment context and silently re-parent those children's containing block. A
 * class toggle costs one ResizeObserver and changes nothing else.
 *
 * The wrapper's own width does not change when the rail opens (only .log-content-clip
 * shrinks), so syncTroubleRailWidth cannot oscillate across the breakpoint.
 *
 * The host builds the report HTML (trouble-detail-handler.ts) so the signal-report
 * builders can be reused there; this script never classifies or reads the log.
 */

/** Embedded webview JavaScript for the Trouble Mode side rail. */
export function getTroubleDetailScript(): string {
    return /* javascript */ `
/* Wrapper width at or above which the rail sits BESIDE the feed. Below it the rail
   falls back to the original full-feed overlay: a sidebar this narrow cannot show a
   readable stack frame and a legible log at the same time. */
var TROUBLE_RAIL_MIN_WIDTH = 700;

/* The issue currently shown in the rail, so Copy Report can rebuild the host payload
   for the same line without a re-selection, and Reveal in log can scroll back to it.
   sourceLineNo is a FILE line number (the host's coordinate space); viewerLine is the
   1-based row index scrollToLineNumber expects — they are not interchangeable. */
var troubleDetailLast = null;

function openTroubleDetailForItem(item) {
    if (!item || typeof vscodeApi === 'undefined') { return; }
    var plain = (typeof stripTags === 'function') ? stripTags(item.html || '') : (item.rawText || '');
    troubleDetailLast = {
        sourceLineNo: item.sourceLineNo || 0,
        plainText: plain,
        level: item.level || 'info',
        viewerLine: (typeof item.viewerLineIndex === 'number') ? item.viewerLineIndex + 1 : 0,
        timestamp: (typeof item.timestamp === 'number') ? item.timestamp : 0,
    };
    /* Mark the chart window this row falls in, so the strip answers "where in the
       session is the report I am reading". Guarded — the chart script owns the mark. */
    if (typeof setTroubleChartSelection === 'function') { setTroubleChartSelection(troubleDetailLast.timestamp); }
    vscodeApi.postMessage({ type: 'openTroubleDetail', sourceLineNo: troubleDetailLast.sourceLineNo, plainText: plain, level: troubleDetailLast.level });
}

/* Copy a Markdown report for the shown issue (host builds + writes the clipboard). */
function copyTroubleReport() {
    if (!troubleDetailLast || typeof vscodeApi === 'undefined') { return; }
    vscodeApi.postMessage({
        type: 'copyTroubleReport',
        sourceLineNo: troubleDetailLast.sourceLineNo,
        plainText: troubleDetailLast.plainText,
        level: troubleDetailLast.level,
    });
}

/* Scroll the feed back to the line this report describes. Only meaningful in the wide
   rail (in the narrow overlay the feed is covered), so the button disables itself
   there rather than scrolling something the user cannot see. */
function revealTroubleDetailLine() {
    if (!troubleDetailLast || !troubleDetailLast.viewerLine) { return; }
    if (typeof scrollToLineNumber === 'function') { scrollToLineNumber(troubleDetailLast.viewerLine); }
}

/* Drag-to-resize bounds — same 320/560 rationale as the shipped clamp() this overrides:
   narrower than 320 cannot show a readable stack frame, wider than 560 starves the feed. */
var TROUBLE_RAIL_MIN_PX = 320;
var TROUBLE_RAIL_MAX_PX = 560;

/* Left-edge grip drag (precedent: viewer-scrollbar-minimap-resize.ts initMinimapResize).
   Reads the CURRENT rendered width as the drag start point rather than a stored var, so
   the first drag after load picks up wherever the clamp() (or a restored custom px)
   already put the rail — there is no separate "clamp vs custom" state to keep in sync. */
function initTroubleRailResize() {
    var handle = document.getElementById('trouble-rail-resize');
    var rail = document.getElementById('trouble-detail');
    if (!handle || !rail) { return; }
    handle.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        var startX = e.clientX;
        var startW = rail.getBoundingClientRect().width;
        var pid = e.pointerId;
        var lastW = startW;
        document.body.classList.add('tr-resizing');
        function onMove(ev) {
            if (ev.pointerId !== pid) { return; }
            ev.preventDefault();
            /* Handle sits on the rail's LEFT edge: dragging left grows the rail (same
               sign convention as the minimap's left-edge handle). */
            var delta = startX - ev.clientX;
            var nextW = Math.round(Math.max(TROUBLE_RAIL_MIN_PX, Math.min(TROUBLE_RAIL_MAX_PX, startW + delta)));
            if (nextW === lastW) { return; }
            lastW = nextW;
            rail.style.width = lastW + 'px';
        }
        function onDone(ev) {
            if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) { return; }
            document.body.classList.remove('tr-resizing');
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onDone);
            handle.removeEventListener('pointercancel', onDone);
            handle.removeEventListener('lostpointercapture', onDone);
            if (typeof vscodeApi !== 'undefined') {
                vscodeApi.postMessage({ type: 'setTroubleRailCustomPx', value: lastW });
            }
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onDone);
        handle.addEventListener('pointercancel', onDone);
        handle.addEventListener('lostpointercapture', onDone);
    });
}

/* Restore a previously dragged width from workspace state (host sends this once at
   startup). Clamped defensively — a malformed or stale value must not paint the rail
   off-screen. */
function handleTroubleRailWidthPx(msg) {
    if (typeof msg.px !== 'number' || msg.px < TROUBLE_RAIL_MIN_PX || msg.px > TROUBLE_RAIL_MAX_PX) { return; }
    var rail = document.getElementById('trouble-detail');
    if (rail) { rail.style.width = msg.px + 'px'; }
}

/* Wide enough for two columns? Toggles the class the rail's static-column rules key
   on. Cheap and idempotent; safe to call on every resize frame. */
function syncTroubleRailWidth() {
    if (typeof document === 'undefined') { return; }
    var wrap = document.getElementById('log-content-wrapper');
    if (!wrap) { return; }
    document.body.classList.toggle('slc-trouble-rail-wide', wrap.clientWidth >= TROUBLE_RAIL_MIN_WIDTH);
    var reveal = document.getElementById('trouble-detail-reveal');
    if (reveal) { reveal.disabled = !document.body.classList.contains('slc-trouble-rail-wide'); }
}

/* Reveal the rail in one of its two modes ('report' | 'crashlytics'). The body class
   is what the rest of the page reads to know the feed is sharing its width. Focus
   moves into the rail (it carries tabindex="-1") so Escape closes it from a fresh
   open, not only after a manual tab-in. */
function openTroubleRail(mode) {
    if (typeof document === 'undefined') { return; }
    var el = document.getElementById('trouble-detail');
    if (!el) { return; }
    syncTroubleRailWidth();
    el.classList.toggle('td-mode-cd', mode === 'crashlytics');
    el.classList.remove('u-hidden');
    document.body.classList.add('slc-trouble-rail-open');
    if (typeof el.focus === 'function') { el.focus(); }
}

/* Render the host reply into the rail and reveal it. Title is set as text (not HTML)
   so a fault line containing angle brackets can never inject markup. The severity
   class drives the head's colored cap; it comes from the SAME item.level the feed
   filtered on, never a re-classification. */
function renderTroubleDetail(msg) {
    if (typeof document === 'undefined') { return; }
    var el = document.getElementById('trouble-detail');
    if (!el) { return; }
    var titleEl = document.getElementById('trouble-detail-title');
    var bodyEl = document.getElementById('trouble-detail-body');
    if (titleEl) { titleEl.textContent = (msg && msg.title) || ''; }
    if (bodyEl) { bodyEl.innerHTML = (msg && msg.html) || ''; }
    var level = (troubleDetailLast && troubleDetailLast.level) || 'error';
    el.classList.remove('td-sev-warning', 'td-sev-performance');
    if (level === 'warning' || level === 'performance') { el.classList.add('td-sev-' + level); }
    openTroubleRail('report');
}

/* Single close path for BOTH rail modes, so one Escape and one × behave the same way
   whichever detail is showing. Clears the band's selected row and the chart's window
   mark so no stale wayfinding survives the close. */
function closeTroubleDetail() {
    if (typeof document === 'undefined') { return; }
    var el = document.getElementById('trouble-detail');
    if (el) { el.classList.add('u-hidden'); el.classList.remove('td-mode-cd'); }
    document.body.classList.remove('slc-trouble-rail-open');
    if (typeof clearTroubleCrashlyticsSelection === 'function') { clearTroubleCrashlyticsSelection(); }
    if (typeof setTroubleChartSelection === 'function') { setTroubleChartSelection(0); }
}

(function() {
    if (typeof document === 'undefined') { return; }
    var closeBtn = document.getElementById('trouble-detail-close');
    /* The Crashlytics detail owns its own Back button, but the rail's × must close it
       too — route through the crashlytics closer when the rail is in that mode so the
       panel's cpDetailIssueId bookkeeping is reset with it. */
    if (closeBtn) { closeBtn.addEventListener('click', function() { closeTroubleRailAnyMode(); }); }
    var copyBtn = document.getElementById('trouble-detail-copy');
    if (copyBtn) { copyBtn.addEventListener('click', function() { copyTroubleReport(); }); }
    var revealBtn = document.getElementById('trouble-detail-reveal');
    if (revealBtn) { revealBtn.addEventListener('click', function() { revealTroubleDetailLine(); }); }
    initTroubleRailResize();
    var el = document.getElementById('trouble-detail');
    if (el) {
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { e.stopPropagation(); closeTroubleRailAnyMode(); }
        });
    }
    /* Keep the wide/narrow class true as the sidebar is dragged or the window resized.
       Observing the WRAPPER (not the log element) means opening the rail — which only
       shrinks the feed inside the wrapper — cannot feed back into this measurement. */
    var wrap = document.getElementById('log-content-wrapper');
    if (wrap && typeof ResizeObserver === 'function') { new ResizeObserver(syncTroubleRailWidth).observe(wrap); }
    syncTroubleRailWidth();
})();

/* Close the rail whichever detail it holds. In Crashlytics mode the panel's closer
   runs first (it resets cpDetailIssueId and the active container) and calls back into
   closeTroubleDetail; otherwise close directly. */
function closeTroubleRailAnyMode() {
    var el = document.getElementById('trouble-detail');
    if (el && el.classList.contains('td-mode-cd') && typeof window.slcCloseCrashlyticsDetail === 'function') {
        window.slcCloseCrashlyticsDetail();
        return;
    }
    closeTroubleDetail();
}
`;
}
