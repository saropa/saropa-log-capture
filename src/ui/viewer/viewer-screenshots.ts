/**
 * Webview-side screenshot surfaces (plan 114): the per-line camera badge, the
 * floating thumbnail popover, and the footer camera icon whose menu holds the
 * capture options (master + per-trigger toggles, capture now, gallery) beside
 * the live gallery counter.
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
/* file → data URI cache. Explicitly bounded (project queue doctrine): maxPerLog is
   configurable up to 500 × up to 10MB per image, so "the cap is small" is not a bound.
   FIFO-evict beyond SCREENSHOT_CACHE_MAX; an evicted image is simply refetched on demand. */
var SCREENSHOT_CACHE_MAX = 12;
var screenshotDataUris = {};
var screenshotCacheOrder = [];

function screenshotCachePut(file, dataUri) {
    if (!(file in screenshotDataUris)) {
        screenshotCacheOrder.push(file);
        if (screenshotCacheOrder.length > SCREENSHOT_CACHE_MAX) {
            var evict = screenshotCacheOrder.shift();
            delete screenshotDataUris[evict];
        }
    }
    screenshotDataUris[file] = dataUri;
}
var screenshotSessionCount = 0;
/* file whose image the open popover is waiting for/showing (null = popover closed). */
var screenshotPopoverFile = null;

/* True when a row's rendered html plausibly contains the capture's trigger text. The
   token is the text's first 30 chars minus HTML-special chars (the html is escaped +
   linkified, so <>&" would never match literally). Empty text (manual captures) matches. */
function screenshotRowTextMatches(item, text) {
    if (!text) return true;
    var token = String(text).replace(/[<>&"']/g, ' ').trim().slice(0, 30).trim();
    return token.length < 4 || (item.html || '').indexOf(token) >= 0;
}

/* Map a capture to its allLines index. logLine counts CAPTURED lines (session-cumulative
   across splits, header uncounted) so it is a HINT: prefer a 'line'-typed row at that
   sourceLineNo whose html contains the trigger text; degrade through weaker matches, and
   when the number misses entirely, fall back to a text search from the tail (mirrors the
   host-side locateLine pattern). Walks backwards because live captures anchor near the tail. */
function screenshotFindIdx(logLine, text) {
    if (typeof allLines === 'undefined') return -1;
    /* A token under 4 chars matches everything — too weak to drive the text-search fallback. */
    var token = text ? String(text).replace(/[<>&"']/g, ' ').trim().slice(0, 30).trim() : '';
    var strongToken = token.length >= 4;
    var lineHit = -1, anyHit = -1, textHit = -1;
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        if (!it || it.type === 'marker') continue;
        if (logLine && it.sourceLineNo === logLine) {
            if (it.type === 'line' && screenshotRowTextMatches(it, text)) return i;
            if (it.type === 'line' && lineHit < 0) lineHit = i;
            if (anyHit < 0) anyHit = i;
        } else if (strongToken && textHit < 0 && it.type === 'line' && (it.html || '').indexOf(token) >= 0) {
            textHit = i;
        }
    }
    if (lineHit >= 0) return lineHit;
    if (anyHit >= 0) return anyHit;
    return textHit;
}

/* Rebuild the badge map from a full sidecar list (sent on load / request). */
function screenshotApplyList(msg) {
    screenshotByIdx = {};
    var list = (msg && Array.isArray(msg.screenshots)) ? msg.screenshots : [];
    screenshotSessionCount = list.length;
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e) continue;
        var idx = screenshotFindIdx(e.logLine, e.text);
        if (idx >= 0) screenshotByIdx[idx] = e;
    }
    screenshotSyncFooter();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/* One live capture landed: badge its line and bump the footer counter. */
function screenshotHandleCaptured(msg) {
    if (!msg) return;
    if (typeof msg.totalForLog === 'number') screenshotSessionCount = msg.totalForLog;
    var idx = screenshotFindIdx(msg.logLine, msg.text);
    if (idx >= 0) {
        screenshotByIdx[idx] = { file: msg.file, trigger: msg.trigger, timestamp: msg.timestamp, logLine: msg.logLine, text: msg.text };
        if (typeof renderViewport === 'function') renderViewport(true);
    }
    screenshotSyncFooter();
}

/* Image reply: cache and, if the popover still waits on this file, show it. An error
   reply (missing/oversized/corrupt PNG) swaps the loading dots for a visible message —
   never leave the popover stuck on its placeholder. */
function screenshotHandleImage(msg) {
    if (!msg || typeof msg.file !== 'string') return;
    if (typeof msg.dataUri !== 'string') {
        if (screenshotPopoverFile === msg.file) {
            var el = screenshotPopoverEl();
            el.textContent = '';
            var failCap = document.createElement('div');
            failCap.className = 'screenshot-popover-caption';
            failCap.textContent = (typeof vt === 'function') ? vt('viewer.screenshot.unavailable') : 'Image unavailable';
            el.appendChild(failCap);
        }
        return;
    }
    screenshotCachePut(msg.file, msg.dataUri);
    if (screenshotPopoverFile === msg.file) screenshotPopoverShow(msg.file);
}

/* Live settings driving the footer menu; replaced wholesale by each screenshotSettings
   message (defaults mirror the published setting defaults for the pre-message window). */
var screenshotTriggerSettings = { enabled: true, onError: true, onWarning: false, onNavigation: false, cooldownMs: 2000, maxPerLog: 50 };

function screenshotHandleSettings(msg) {
    if (!msg) return;
    screenshotTriggerSettings = {
        enabled: msg.enabled !== false,
        onError: msg.onError !== false,
        onWarning: msg.onWarning === true,
        onNavigation: msg.onNavigation === true,
        cooldownMs: typeof msg.cooldownMs === 'number' ? msg.cooldownMs : 2000,
        maxPerLog: typeof msg.maxPerLog === 'number' ? msg.maxPerLog : 50,
    };
    screenshotSyncFooter();
    screenshotMenuSync();
}

/* Footer: icon dims when the master toggle is off; counter shows/hides on count. */
function screenshotSyncFooter() {
    var toggle = document.getElementById('screenshot-toggle');
    var count = document.getElementById('screenshot-count');
    if (toggle) toggle.classList.toggle('screenshot-toggle-off', !screenshotTriggerSettings.enabled);
    if (count) {
        count.textContent = screenshotSessionCount > 0 ? String(screenshotSessionCount) : '';
        count.classList.toggle('u-hidden', screenshotSessionCount <= 0);
    }
}

/* ── Camera options menu (anchored to the footer icon) ─────────────────── */

/* Checkbox rows: setting key ↔ vt label. Rendered in this order. */
var screenshotMenuToggles = [
    { key: 'enabled', label: 'viewer.screenshot.menu.master' },
    { key: 'onError', label: 'viewer.screenshot.menu.onError' },
    { key: 'onWarning', label: 'viewer.screenshot.menu.onWarning' },
    { key: 'onNavigation', label: 'viewer.screenshot.menu.onNavigation' },
];

function screenshotMenuEl() {
    var el = document.getElementById('screenshot-menu');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'screenshot-menu';
    el.className = 'screenshot-menu u-hidden';
    var html = '';
    for (var i = 0; i < screenshotMenuToggles.length; i++) {
        var tgl = screenshotMenuToggles[i];
        html += '<label class="screenshot-menu-row' + (tgl.key === 'enabled' ? ' screenshot-menu-master' : '') + '">'
            + '<input type="checkbox" data-shot-setting="' + tgl.key + '">'
            + '<span>' + vt(tgl.label) + '</span></label>';
    }
    html += '<div class="screenshot-menu-sep"></div>'
        + '<button type="button" class="screenshot-menu-row screenshot-menu-action" data-shot-action="captureNow">' + vt('viewer.screenshot.menu.captureNow') + '</button>'
        + '<button type="button" class="screenshot-menu-row screenshot-menu-action" data-shot-action="openGallery">' + vt('viewer.screenshot.menu.openGallery') + '</button>'
        + '<div class="screenshot-menu-limits" id="screenshot-menu-limits"></div>';
    el.innerHTML = html;
    document.body.appendChild(el);
    el.addEventListener('change', function(e) {
        var key = e.target && e.target.getAttribute && e.target.getAttribute('data-shot-setting');
        if (!key || typeof vscodeApi === 'undefined') return;
        /* Optimistic local flip; the host echoes screenshotSettings after persisting. */
        screenshotTriggerSettings[key] = !!e.target.checked;
        screenshotSyncFooter();
        vscodeApi.postMessage({ type: 'setScreenshotTrigger', key: key, value: !!e.target.checked });
    });
    el.addEventListener('click', function(e) {
        var action = e.target && e.target.getAttribute && e.target.getAttribute('data-shot-action');
        if (!action || typeof vscodeApi === 'undefined') return;
        if (action === 'captureNow') vscodeApi.postMessage({ type: 'captureScreenshotNow' });
        else if (action === 'openGallery') vscodeApi.postMessage({ type: 'openScreenshotGallery' });
        screenshotMenuClose();
    });
    return el;
}

/* Reflect current settings into the menu's checkboxes + limits line (no-op while unbuilt). */
function screenshotMenuSync() {
    var el = document.getElementById('screenshot-menu');
    if (!el) return;
    var boxes = el.querySelectorAll('input[data-shot-setting]');
    for (var i = 0; i < boxes.length; i++) {
        var key = boxes[i].getAttribute('data-shot-setting');
        boxes[i].checked = !!screenshotTriggerSettings[key];
        /* Sub-triggers are moot while the master is off — disable so the hierarchy reads. */
        if (key !== 'enabled') boxes[i].disabled = !screenshotTriggerSettings.enabled;
    }
    var limits = document.getElementById('screenshot-menu-limits');
    /* Pass args pre-stringified — vt()'s split/join substitution is only proven for strings. */
    if (limits) limits.textContent = vt('viewer.screenshot.menu.limits', String(screenshotTriggerSettings.cooldownMs / 1000), String(screenshotTriggerSettings.maxPerLog));
}

function screenshotMenuClose() {
    var el = document.getElementById('screenshot-menu');
    if (el) el.classList.add('u-hidden');
}

/* Toggle the menu anchored to the icon; opens above the icon when it sits in the lower
   half of the window (the footer bar usually does). */
function screenshotMenuOpen(iconEl) {
    var el = screenshotMenuEl();
    if (!el.classList.contains('u-hidden')) { screenshotMenuClose(); return; }
    screenshotMenuSync();
    var r = iconEl.getBoundingClientRect();
    el.style.left = Math.min(r.left, Math.max(8, window.innerWidth - 240)) + 'px';
    if (r.top > window.innerHeight / 2) { el.style.top = ''; el.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
    else { el.style.bottom = ''; el.style.top = (r.bottom + 4) + 'px'; }
    el.classList.remove('u-hidden');
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
    if (toggle) { screenshotMenuOpen(toggle); return; }
    var counter = t.closest('#screenshot-count');
    if (counter) {
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'openScreenshotGallery' });
        return;
    }
    if (!t.closest('#screenshot-popover')) screenshotPopoverClose();
    if (!t.closest('#screenshot-menu')) screenshotMenuClose();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { screenshotPopoverClose(); screenshotMenuClose(); } });
`;
}
