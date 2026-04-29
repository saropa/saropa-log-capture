"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerScript = getViewerScript;
/**
 * Client-side log viewer script (virtual scroll, tail-follow, jump controls, etc.), emitted as a
 * string for the webview `<script>` tag.
 *
 * **Embedded template literal safety:** The returned body is a TypeScript template literal. Do not
 * put backtick characters inside the embedded JavaScript or CSS text — they terminate the TS string
 * and break compilation or silently truncate the runtime script. Use slash-star block comments or
 * single-quoted strings only inside the embedded code.
 */
const viewer_script_keyboard_1 = require("./viewer-script-keyboard");
const viewer_script_footer_1 = require("./viewer-script-footer");
const viewer_script_messages_1 = require("./viewer-script-messages");
const viewer_script_click_handlers_1 = require("./viewer-script-click-handlers");
function getViewerScript(maxLines, viewerPreserveAsciiBoxArt = true, viewerGroupAsciiArt = true, viewerDetectAsciiArt = false) {
    return /* javascript */ `
var logEl = document.getElementById('log-content');
var logWrapEl = document.getElementById('log-content-wrapper');
/* Clip parent of #log-content. #log-content is 10px wider than this clip (so the native
   vertical scrollbar paints in clipped overflow — invisible). Use its rect, not logEl's,
   for jump-button inset calculations: logEl.getBoundingClientRect().right extends into
   the clipped zone and would push jump buttons off the visible edge. */
var logClipEl = document.querySelector('.log-content-clip');
var spacerTop = document.getElementById('spacer-top');
var viewportEl = document.getElementById('viewport');
var spacerBottom = document.getElementById('spacer-bottom');
var jumpBtn = document.getElementById('jump-btn');
var jumpTopBtn = document.getElementById('jump-top-btn');
/** Toggle the Show-native-scrollbar setting via body.scrollbar-visible.
 *  The class controls layout — .log-content-clip flips between overflow: hidden
 *  (scrollbar clipped off-screen) and overflow: visible (scrollbar in view), and
 *  #log-content's width/padding-right compensate. No ::-webkit-scrollbar width
 *  changes, so Chromium's pseudo-element cache is a non-issue. */
function applyScrollbarVisible(show) {
    document.body.classList.toggle('scrollbar-visible', !!show);
    syncJumpButtonInset();
}

/* Pin jump buttons to the log pane top-right / bottom-right using viewport coordinates.
   position:fixed plus #log-content getBoundingClientRect avoids bad containing blocks (some webviews
   mis-resolve absolute + right so controls appear on the text left edge). */
function syncJumpButtonInset() {
    /* Require log rect only so jump controls stay anchored during resizes. */
    if (!logEl) return;
    /* Use the clip parent's rect as the visible-area reference: #log-content extends
       10px past it into clipped overflow, so logEl.getBoundingClientRect().right would
       put the jump buttons past the visible edge when the scrollbar is hidden. */
    var lr = (logClipEl || logEl).getBoundingClientRect();
    if (lr.width < 8 || lr.height < 8) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* --scrollbar-w is 10px only when body.scrollbar-visible is set (clip lifted,
       scrollbar in view). In that state lr.right already coincides with the scrollbar's
       outer edge, so sbW adds 10px of inset to keep the buttons off the slider. */
    var sbW = logWrapEl ? (parseInt(getComputedStyle(logWrapEl).getPropertyValue('--scrollbar-w'), 10) || 0) : 0;
    var rightPx = Math.max(8, Math.round(vw - lr.right + 8 + sbW));
    var replayBar = document.getElementById('replay-bar');
    var replayNudge = replayBar && replayBar.classList.contains('replay-bar-visible') ? 44 : 0;
    if (jumpBtn) {
        jumpBtn.style.setProperty('position', 'fixed', 'important');
        jumpBtn.style.setProperty('right', rightPx + 'px', 'important');
        jumpBtn.style.setProperty('left', 'auto', 'important');
        jumpBtn.style.setProperty('bottom', Math.round(vh - lr.bottom + 8 + replayNudge) + 'px', 'important');
        jumpBtn.style.setProperty('top', 'auto', 'important');
    }
    if (jumpTopBtn) {
        jumpTopBtn.style.setProperty('position', 'fixed', 'important');
        jumpTopBtn.style.setProperty('right', rightPx + 'px', 'important');
        jumpTopBtn.style.setProperty('left', 'auto', 'important');
        jumpTopBtn.style.setProperty('top', Math.round(lr.top + 8) + 'px', 'important');
        jumpTopBtn.style.setProperty('bottom', 'auto', 'important');
    }
}
syncJumpButtonInset();
/** Only show scroll buttons when content exceeds this fraction of the viewport height. */
var SCROLL_BTN_THRESHOLD = 1.5;
/** Schmitt-trigger band for tail-follow: avoids autoScroll flipping when distance-to-bottom jitters (layout/subpixel). */
var AT_BOTTOM_ON_PX = 36;
var AT_BOTTOM_OFF_PX = 56;
var footerEl = document.getElementById('viewer-toolbar');
var footerTextEl = document.getElementById('footer-text');
var footerVersion = footerTextEl ? (footerTextEl.getAttribute('data-version') || '') : '';
/* Footer filename gestures: click=reveal, long-press=copy, dblclick=open folder. */
var _fnPressTimer = null;
var _fnLongFired = false;
function _fnCancelTimer() { if (_fnPressTimer) { clearTimeout(_fnPressTimer); _fnPressTimer = null; } }
if (footerTextEl) {
    footerTextEl.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        var fnEl = e.target && e.target.closest ? e.target.closest('.footer-filename') : null;
        if (!fnEl) return;
        e.preventDefault();
        _fnLongFired = false;
        _fnPressTimer = setTimeout(function() {
            _fnPressTimer = null;
            _fnLongFired = true;
            vscodeApi.postMessage({ type: 'copyCurrentFilePath' });
            fnEl.title = 'Copied!';
            setTimeout(function() { fnEl.title = 'Click: reveal \\u00b7 Hold: copy path \\u00b7 Double-click: open folder'; }, 1500);
        }, 500);
    });
    footerTextEl.addEventListener('mouseup', _fnCancelTimer);
    footerTextEl.addEventListener('mouseleave', _fnCancelTimer);
    footerTextEl.addEventListener('dragstart', function(e) { e.preventDefault(); _fnCancelTimer(); });
    footerTextEl.addEventListener('click', function(e) {
        var fnEl = e.target && e.target.closest ? e.target.closest('.footer-filename') : null;
        if (!fnEl) return;
        if (_fnLongFired) { _fnLongFired = false; return; }
        vscodeApi.postMessage({ type: 'revealLogFile' });
    });
    footerTextEl.addEventListener('dblclick', function(e) {
        var fnEl = e.target && e.target.closest ? e.target.closest('.footer-filename') : null;
        if (!fnEl) return;
        e.preventDefault();
        vscodeApi.postMessage({ type: 'openCurrentFileFolder' });
    });
}
var wrapToggle = document.getElementById('wrap-toggle');

var vscodeApi = acquireVsCodeApi();
window._vscodeApi = vscodeApi;
if (window._scriptErrors && window._scriptErrors.length) {
    vscodeApi.postMessage({ type: 'scriptError', errors: window._scriptErrors });
}
/* Clear panel badge when user focuses webview (onDidChangeVisibility only fires on hide/show toggle). */
document.addEventListener('focus', function() { vscodeApi.postMessage({ type: 'viewerFocused' }); }, true);
var MAX_LINES = ${maxLines};
var MAX_LINES_DEFAULT = MAX_LINES;
/* Noise learning (set by host via setLearningOptions). */
var learningEnabled = false, learningMaxLineLen = 2000, learningTrackScroll = false;
var learningScrollLastT = 0, learningScrollLastTop = 0, learningScrollBurstSent = 0, learningScrollBurstReset = 0;
var ROW_HEIGHT = 20;
var MARKER_HEIGHT = 28;
var OVERSCAN = 30;

var allLines = [], totalHeight = 0, lineCount = 0;
var autoScroll = true, isPaused = false, isViewingFile = false, wordWrap = false, isSessionActive = false;
var nextGroupId = 0, activeGroupHeader = null, groupHeaderMap = {};
var lastStart = -1, lastEnd = -1, rafPending = false;
var currentFilename = '', nextSeq = 1, scrollMemory = {};
var loadTruncatedInfo = null;
/** Structured file mode (plan 051): 'log' | 'markdown' | 'json' | 'csv' | 'html'. Non-log modes skip analysis. */
var fileMode = 'log';
/** Whether the format toggle is on for the current non-log file. */
var formatEnabled = false;
var correlationByLineIndex = {};
/* When true, paired "│ … │" banner rows are not stack frames (see isStackFrameText). Baked from host config. */
var viewerPreserveAsciiBoxArt = ${viewerPreserveAsciiBoxArt ? 'true' : 'false'};
/* When true, consecutive separator lines with the same timestamp are grouped into a visual block. */
var viewerGroupAsciiArt = ${viewerGroupAsciiArt ? 'true' : 'false'};
/* Experimental: detect pixel-based ASCII art via entropy heuristics (default false). */
var viewerDetectAsciiArt = ${viewerDetectAsciiArt ? 'true' : 'false'};
/* Minimap / scrollbar settings: mirrored from host postMessage for context-menu checkmarks (see viewer-script-messages). */
var minimapProportionalLines = true;
var minimapShowInfoMarkers = false;
var minimapViewportRedOutline = false;
var minimapViewportOutsideArrow = false;

/** Strip HTML tags and decode entities; null/undefined-safe so Copy All and copy-float never throw on missing line.html. */
function stripTags(html) {
    var s = (html == null ? '' : String(html)).replace(/<[^>]*>/g, '');
    return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
/** Detect stack frame lines across multiple formats (JS, Dart, Python, etc). Mirrors isStackFrameLine in stack-parser.ts. */
function isStackFrameText(html) {
    var plain = stripTags(html);
    var trimmed = plain.replace(/^\\s+/, '');
    if (!trimmed) return false;
    if (/^\\s+at\\s/.test(plain)) return true;           // JS/Node: "    at Function.foo ..."
    if (/^#\\d+\\s/.test(trimmed)) return true;          // Dart: "#0  ClassName.method ..."
    if (/^\\s+File "/.test(plain)) return true;          // Python: '  File "foo.py"'
    // LIGHT VERTICAL (│): real traces often use a single gutter bar; paired bars on one line are log banners.
    if (/^\\s*\\u2502\\s/.test(plain)) {
        if (viewerPreserveAsciiBoxArt && /^\\s*\\u2502\\s+(?:.*\\S\\s*)?\\u2502\\s*$/.test(plain)) return false;
        return true;
    }
    if (/^package:/.test(trimmed)) return true;          // Dart package paths
    if (/^\\s+\\S+\\.\\S+:\\d+/.test(plain)) return true; // Generic: "  pkg.Func:123"
    // Mid-line Dart source paths: "Method package:foo/bar.dart:1:2" or "(./lib/foo.dart:1:2)"
    if (/\\bpackage:\\S+\\.dart:\\d+/.test(plain)) return true;
    return /\\(\\.\\\/\\S+\\.dart:\\d+:\\d+\\)/.test(plain);
}

function handleScroll() {
    if (typeof suppressScroll !== 'undefined' && suppressScroll) return;
    if (!logEl) return;
    var distBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight;
    if (autoScroll) {
        if (distBottom > AT_BOTTOM_OFF_PX) autoScroll = false;
    } else {
        if (distBottom < AT_BOTTOM_ON_PX) autoScroll = true;
    }
    renderViewport(false);
    var isTall = logEl.scrollHeight > logEl.clientHeight * SCROLL_BTN_THRESHOLD;
    if (jumpBtn) jumpBtn.style.display = (distBottom > AT_BOTTOM_ON_PX && isTall) ? 'block' : 'none';
    if (jumpTopBtn) jumpTopBtn.style.display = (logEl.scrollTop > logEl.clientHeight * 0.5 && isTall) ? 'block' : 'none';
    /* Optional fast-scroll learning: bounded bursts so we do not flood the extension. */
    if (learningEnabled && learningTrackScroll && allLines.length > 0) {
        var now = Date.now();
        if (now - learningScrollBurstReset > 1200) { learningScrollBurstSent = 0; learningScrollBurstReset = now; }
        if (learningScrollBurstSent < 24) {
            var dt = now - learningScrollLastT;
            if (dt >= 8) {
                var speed = Math.abs(logEl.scrollTop - learningScrollLastTop) / Math.max(1, dt);
                learningScrollLastT = now;
                learningScrollLastTop = logEl.scrollTop;
                if (speed > 2.5) {
                    var mid = logEl.scrollTop + logEl.clientHeight / 2;
                    var centerIdx = 0;
                    if (typeof findIndexAtOffset === 'function' && prefixSums) {
                        centerIdx = findIndexAtOffset(mid).index;
                    } else {
                        var acc = 0;
                        for (var cj = 0; cj < allLines.length; cj++) {
                            acc += allLines[cj].height;
                            if (acc >= mid) { centerIdx = cj; break; }
                        }
                    }
                    var seenIdx = {};
                    for (var di = -12; di <= 12 && learningScrollBurstSent < 24; di++) {
                        var idx = centerIdx + di;
                        if (idx < 0 || idx >= allLines.length || seenIdx[idx]) continue;
                        seenIdx[idx] = 1;
                        var lit = allLines[idx];
                        if (!lit || (lit.type !== 'line' && lit.type !== 'stack-frame')) continue;
                        var pl = stripTags(lit.html || '');
                        if (!pl) continue;
                        vscodeApi.postMessage({
                            type: 'trackInteraction',
                            interactionType: 'skip-scroll',
                            lineText: pl.substring(0, 100),
                            lineLevel: lit.level || ''
                        });
                        learningScrollBurstSent++;
                    }
                }
            }
        }
    }
}

if (logEl) logEl.addEventListener('scroll', function() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(function() { rafPending = false; handleScroll(); }); }
});

if (logEl) logEl.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    var scale = e.deltaMode === 2 ? logEl.clientHeight : e.deltaMode === 1 ? ROW_HEIGHT : 1;
    logEl.scrollTop += e.deltaY * scale;
}, { passive: false });

${(0, viewer_script_click_handlers_1.getViewerClickHandlerScript)()}

function toggleWrap() { wordWrap = !wordWrap; if (logEl) logEl.classList.toggle('nowrap', !wordWrap); renderViewport(true); }
if (wrapToggle) wrapToggle.addEventListener('click', toggleWrap);
if (jumpBtn) jumpBtn.addEventListener('click', jumpToBottom);
if (jumpTopBtn) jumpTopBtn.addEventListener('click', function() {
    if (window.isContextMenuOpen) return;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
    if (logEl) { suppressScroll = true; logEl.scrollTop = 0; suppressScroll = false; }
    autoScroll = false; if (jumpTopBtn) jumpTopBtn.style.display = 'none';
});
function getCenterIdx() {
    if (!logEl) return 0;
    var mid = logEl.scrollTop + logEl.clientHeight / 2;
    if (typeof findIndexAtOffset === 'function' && prefixSums) return findIndexAtOffset(mid).index;
    var h = 0;
    for (var ci = 0; ci < allLines.length; ci++) { h += allLines[ci].height; if (h >= mid) return ci; }
    return allLines.length - 1;
}

function jumpToBottom() {
    if (window.isContextMenuOpen) return;
    if (!logEl) return;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
    suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false;
    autoScroll = true; if (jumpBtn) jumpBtn.style.display = 'none';
}

${(0, viewer_script_footer_1.getViewerScriptFooterChunk)()}

${(0, viewer_script_messages_1.getViewerScriptMessageHandler)()}
${(0, viewer_script_keyboard_1.getKeyboardScriptWithDefaults)()}

var _resizeRaf = false;
function onLogOrWrapResize() {
    if (_resizeRaf) return; _resizeRaf = true;
    requestAnimationFrame(function() {
        _resizeRaf = false;
        syncJumpButtonInset();
        if (logEl && allLines.length > 0 && logEl.clientHeight > 0) {
            renderViewport(false);
            if (autoScroll && !window.isContextMenuOpen) {
                if (window.setProgrammaticScroll) window.setProgrammaticScroll();
                suppressScroll = true;
                logEl.scrollTop = logEl.scrollHeight;
                suppressScroll = false;
                /* Same render-snap-render guard as the addLines path: the first render
                   used the pre-snap scrollTop, so when a resize moves the bottom by
                   more than OVERSCAN rows the snapped view lands in empty bottom-spacer
                   space until the next event re-renders. Re-render here uses the
                   snapped scrollTop and paints the tail in the same frame. */
                renderViewport(false);
            }
        }
    });
}
if (logEl) new ResizeObserver(onLogOrWrapResize).observe(logEl);
if (logWrapEl) new ResizeObserver(onLogOrWrapResize).observe(logWrapEl);
/* Fallback: some VS Code webview resize scenarios (e.g. window border drag) may not
   trigger ResizeObserver on the log element. window.resize guarantees re-layout. */
window.addEventListener('resize', onLogOrWrapResize);
requestAnimationFrame(function() { requestAnimationFrame(syncJumpButtonInset); });
`;
}
//# sourceMappingURL=viewer-script.js.map