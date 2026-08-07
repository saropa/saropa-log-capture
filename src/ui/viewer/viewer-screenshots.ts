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
/* Directory holding this log's PNGs (from screenshotList). The popover joins it with a capture's
   bare filename to show the full path — the sidecar itself only ever stores the filename. */
var screenshotDir = '';
/* Path separator for this host, sent alongside the directory. NOT inferred from the directory
   string: the webview has no platform of its own, and a Windows path the host had normalized to
   forward slashes would fool any inference rule into printing a path that does not exist. */
var screenshotSep = '/';

/* Join the capture directory to a bare filename, using the host's own separator. */
function screenshotJoinPath(dir, file) {
    if (!dir) return file;
    return dir + screenshotSep + file;
}

/* Record the capture directory from any message that carries it — the sidecar listing AND a live
   capture, so a popover opened on a just-captured line still knows the full path. */
function screenshotNoteDir(msg) {
    if (!msg) return;
    if (typeof msg.dir === 'string') screenshotDir = msg.dir;
    if (typeof msg.sep === 'string' && msg.sep) screenshotSep = msg.sep;
}
/* file whose image the open popover is waiting for/showing (null = popover closed). */
var screenshotPopoverFile = null;

/* Discriminating token from trigger text: the LONGEST run between HTML-special chars
   (the html is escaped, so a token spanning "&" would face "&amp;" and never match).
   Taking a clean segment — not a specials-stripped mash — keeps indexOf exact. */
function screenshotTextToken(text) {
    if (!text) return '';
    var parts = String(text).split(/[<>&"']/);
    var best = '';
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (p.length > best.length) best = p;
    }
    return best.slice(0, 30).trim();
}

/* True when a row's rendered html plausibly contains the capture's trigger text.
   Empty/degenerate tokens (manual captures, all-special text) match everything. */
function screenshotRowTextMatches(item, text) {
    var token = screenshotTextToken(text);
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
    var token = screenshotTextToken(text);
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
    screenshotNoteDir(msg);
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
    screenshotNoteDir(msg);
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

/* Footer: icon dims when the master toggle is off; the count pill shows/hides on count;
   the shoot button exists only while a live capture target does (see the toolbar HTML). */
function screenshotSyncFooter() {
    var toggle = document.getElementById('screenshot-toggle');
    var count = document.getElementById('screenshot-count');
    var shoot = document.getElementById('screenshot-shoot');
    if (toggle) toggle.classList.toggle('screenshot-toggle-off', !screenshotTriggerSettings.enabled);
    /* Both count surfaces carry the same number: the toolbar pill (live feed) and the log
       banner pill (the identity of the log being read). */
    var pills = [count, document.getElementById('log-banner-screenshot-pill')];
    for (var p = 0; p < pills.length; p++) {
        if (!pills[p]) continue;
        pills[p].textContent = screenshotSessionCount > 0 ? '\\u{1F4F7} ' + screenshotSessionCount : '';
        pills[p].classList.toggle('u-hidden', screenshotSessionCount <= 0);
    }
    if (shoot) {
        /* Capture-on-demand needs something to photograph: a live session, the feature on,
           and the viewer showing that session rather than a saved file. */
        var live = screenshotTriggerSettings.enabled
            && typeof isSessionActive !== 'undefined' && isSessionActive
            && !(typeof isViewingFile !== 'undefined' && isViewingFile);
        shoot.classList.toggle('u-hidden', !live);
    }
}

/* Delegated clicks: badge, footer toggle, footer counter. Click-away closes the popover. */
document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var badge = t.closest('.screenshot-badge');
    if (badge) { e.stopPropagation(); screenshotBadgeClick(badge); return; }
    var shoot = t.closest('#screenshot-shoot');
    if (shoot) {
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'captureScreenshotNow' });
        return;
    }
    var toggle = t.closest('#screenshot-toggle');
    if (toggle) { screenshotMenuOpen(toggle); return; }
    var counter = t.closest('#screenshot-count') || t.closest('#log-banner-screenshot-pill');
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
