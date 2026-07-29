/**
 * Webview-side screenshot surfaces (plan 114): the per-line camera badge, the
 * floating thumbnail popover, and the footer camera toggle + gallery counter.
 *
 * The popover is a fixed-position overlay, NOT an inline row expansion — an inline
 * thumbnail would add a variable height term to calcItemHeight and interact with the
 * prefix-sum scroll math and viewport rebuilds for no user benefit over an anchored
 * preview. No line heights are touched anywhere in this module.
 *
 * Images arrive as data URIs via requestScreenshotImage (see
 * viewer-message-handler-screenshots.ts for why not asWebviewUri) and are cached here
 * so re-opening a popover or scrolling does not refetch.
 */
export function getViewerScreenshotsScript(): string {
    return /* javascript */ `
/* allLines index → sidecar entry {file, trigger, timestamp, logLine}. Rebuilt per screenshotList. */
var screenshotByIdx = {};
/* file → data URI cache (bounded: per-log cap is small, images are cooldown-limited). */
var screenshotDataUris = {};
var screenshotSessionCount = 0;
/* file whose image the open popover is waiting for/showing (null = popover closed). */
var screenshotPopoverFile = null;

/* Map a 1-based source line number to its allLines index. Walks backwards because live
   captures anchor near the tail; falls back to a full scan for loaded-file lists. */
function screenshotFindIdx(logLine) {
    if (typeof allLines === 'undefined' || !logLine) return -1;
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        if (it && it.type !== 'marker' && it.sourceLineNo === logLine) return i;
    }
    return -1;
}

/* Rebuild the badge map from a full sidecar list (sent on load / request). */
function screenshotApplyList(msg) {
    screenshotByIdx = {};
    var list = (msg && Array.isArray(msg.screenshots)) ? msg.screenshots : [];
    screenshotSessionCount = list.length;
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e || !e.logLine) continue;
        var idx = screenshotFindIdx(e.logLine);
        if (idx >= 0) screenshotByIdx[idx] = e;
    }
    screenshotSyncFooter();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/* One live capture landed: badge its line and bump the footer counter. */
function screenshotHandleCaptured(msg) {
    if (!msg) return;
    if (typeof msg.totalForLog === 'number') screenshotSessionCount = msg.totalForLog;
    var idx = screenshotFindIdx(msg.logLine);
    if (idx >= 0) {
        screenshotByIdx[idx] = { file: msg.file, trigger: msg.trigger, timestamp: msg.timestamp, logLine: msg.logLine };
        if (typeof renderViewport === 'function') renderViewport(true);
    }
    screenshotSyncFooter();
}

/* Image reply: cache and, if the popover still waits on this file, show it. */
function screenshotHandleImage(msg) {
    if (!msg || typeof msg.file !== 'string' || typeof msg.dataUri !== 'string') return;
    screenshotDataUris[msg.file] = msg.dataUri;
    if (screenshotPopoverFile === msg.file) screenshotPopoverShow(msg.file);
}

/* Footer: icon reflects the enabled boolean (mirrored via integrationAdapters merge);
   counter shows/hides on count. Both elements are static toolbar HTML. */
function screenshotSyncFooter() {
    var toggle = document.getElementById('screenshot-toggle');
    var count = document.getElementById('screenshot-count');
    if (toggle) {
        var on = !window.integrationAdapters || window.integrationAdapters.indexOf('screenshots') >= 0;
        toggle.classList.toggle('screenshot-toggle-off', !on);
        var tip = on ? toggle.getAttribute('data-on-title') : toggle.getAttribute('data-off-title');
        if (tip) { toggle.title = tip; toggle.setAttribute('aria-label', tip); }
    }
    if (count) {
        count.textContent = screenshotSessionCount > 0 ? String(screenshotSessionCount) : '';
        count.classList.toggle('u-hidden', screenshotSessionCount <= 0);
    }
}

function screenshotPopoverEl() {
    var el = document.getElementById('screenshot-popover');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'screenshot-popover';
    el.className = 'screenshot-popover u-hidden';
    document.body.appendChild(el);
    /* Clicking the preview opens the full-size PNG in an editor tab. */
    el.addEventListener('click', function() {
        if (screenshotPopoverFile && typeof vscodeApi !== 'undefined') {
            vscodeApi.postMessage({ type: 'openScreenshotFile', file: screenshotPopoverFile });
        }
        screenshotPopoverClose();
    });
    return el;
}

function screenshotPopoverClose() {
    screenshotPopoverFile = null;
    var el = document.getElementById('screenshot-popover');
    if (el) el.classList.add('u-hidden');
}

/* Fill + reveal the popover for a cached image (position was set at badge click). */
function screenshotPopoverShow(file) {
    var el = screenshotPopoverEl();
    var entry = null;
    for (var k in screenshotByIdx) { if (screenshotByIdx[k] && screenshotByIdx[k].file === file) { entry = screenshotByIdx[k]; break; } }
    var when = entry && entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
    var caption = (typeof vt === 'function') ? vt('viewer.screenshot.popoverCaption', when) : when;
    /* Build via DOM nodes (not innerHTML) — the data URI is huge and must not round-trip
       through an HTML string, and the caption is already vt()-localized text. */
    el.textContent = '';
    var img = document.createElement('img');
    img.className = 'screenshot-popover-img';
    img.alt = '';
    img.src = screenshotDataUris[file];
    var cap = document.createElement('div');
    cap.className = 'screenshot-popover-caption';
    cap.textContent = caption;
    el.appendChild(img);
    el.appendChild(cap);
    el.classList.remove('u-hidden');
}

/* Badge click: anchor the popover near the badge, then show cached or request the image. */
function screenshotBadgeClick(badgeEl) {
    var file = badgeEl.getAttribute('data-shot-file');
    if (!file) return;
    var el = screenshotPopoverEl();
    var r = badgeEl.getBoundingClientRect();
    /* Clamp so a badge near the right/bottom edge never pushes the popover off-screen. */
    el.style.left = Math.min(r.left, Math.max(8, window.innerWidth - 340)) + 'px';
    el.style.top = Math.min(r.bottom + 4, Math.max(8, window.innerHeight - 260)) + 'px';
    screenshotPopoverFile = file;
    if (screenshotDataUris[file]) { screenshotPopoverShow(file); return; }
    el.innerHTML = '<div class="screenshot-popover-caption">…</div>';
    el.classList.remove('u-hidden');
    if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'requestScreenshotImage', file: file });
}

/* Delegated clicks: badge, footer toggle, footer counter. Click-away closes the popover. */
document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var badge = t.closest('.screenshot-badge');
    if (badge) { e.stopPropagation(); screenshotBadgeClick(badge); return; }
    var toggle = t.closest('#screenshot-toggle');
    if (toggle) {
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'toggleScreenshots' });
        return;
    }
    var counter = t.closest('#screenshot-count');
    if (counter) {
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'openScreenshotGallery' });
        return;
    }
    if (!t.closest('#screenshot-popover')) screenshotPopoverClose();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') screenshotPopoverClose(); });
`;
}
