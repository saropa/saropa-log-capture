/**
 * Footer camera options menu (plan 114) — split from viewer-screenshots.ts at the 300-line
 * cap. Shares the webview's single page scope with it: reads `screenshotTriggerSettings`
 * and posts the same messages, so the two files are one feature in two files, not two
 * layers. Loaded immediately after viewer-screenshots.ts (see viewer-content-scripts.ts).
 */
export function getViewerScreenshotMenuScript(): string {
    return /* javascript */ `
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
    /* The full path, not just the filename: a reader looking at a capture in the log needs something
       they can open, copy, or attach. Selectable (the popover's click-to-open handler ignores drags
       on this row) and wrapped, because an absolute path is longer than the popover is wide. */
    var pathEl = document.createElement('div');
    pathEl.className = 'screenshot-popover-path';
    pathEl.textContent = screenshotJoinPath(screenshotDir, file);
    el.appendChild(pathEl);
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
`;
}
