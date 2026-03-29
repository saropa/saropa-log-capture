/**
 * Client-side log viewer script (virtual scroll, tail-follow, jump controls, etc.), emitted as a
 * string for the webview `<script>` tag.
 *
 * **Embedded template literal safety:** The returned body is a TypeScript template literal. Do not
 * put backtick characters inside the embedded JavaScript or CSS text — they terminate the TS string
 * and break compilation or silently truncate the runtime script. Use slash-star block comments or
 * single-quoted strings only inside the embedded code.
 */
import { getKeyboardScriptWithDefaults } from './viewer-script-keyboard';
import { getViewerScriptFooterChunk } from './viewer-script-footer';
import { getViewerScriptMessageHandler } from './viewer-script-messages';

export function getViewerScript(maxLines: number, viewerPreserveAsciiBoxArt = true): string {
    return /* javascript */ `
var logEl = document.getElementById('log-content');
var logWrapEl = document.getElementById('log-content-wrapper');
var spacerTop = document.getElementById('spacer-top');
var viewportEl = document.getElementById('viewport');
var spacerBottom = document.getElementById('spacer-bottom');
var jumpBtn = document.getElementById('jump-btn');
var jumpTopBtn = document.getElementById('jump-top-btn');
/* Pin jump buttons to the log pane top-right / bottom-right using viewport coordinates.
   position:fixed plus #log-content getBoundingClientRect avoids bad containing blocks (some webviews
   mis-resolve absolute + right so controls appear on the text left edge). */
function syncJumpButtonInset() {
    /* Require log rect only so jump controls stay anchored during resizes. */
    if (!logEl) return;
    var lr = logEl.getBoundingClientRect();
    if (lr.width < 8 || lr.height < 8) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var rightPx = Math.max(8, Math.round(vw - lr.right + 8));
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
if (footerTextEl) {
    footerTextEl.addEventListener('mousedown', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('footer-filename')) return;
        _fnLongFired = false;
        _fnPressTimer = setTimeout(function() {
            _fnLongFired = true;
            vscodeApi.postMessage({ type: 'copyCurrentFilePath' });
            e.target.title = 'Copied!';
            setTimeout(function() { e.target.title = 'Click: reveal \\u00b7 Hold: copy path \\u00b7 Double-click: open folder'; }, 1500);
        }, 500);
    });
    footerTextEl.addEventListener('mouseup', function() { if (_fnPressTimer) { clearTimeout(_fnPressTimer); _fnPressTimer = null; } });
    footerTextEl.addEventListener('mouseleave', function() { if (_fnPressTimer) { clearTimeout(_fnPressTimer); _fnPressTimer = null; } });
    footerTextEl.addEventListener('click', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('footer-filename')) return;
        if (_fnLongFired) { _fnLongFired = false; return; }
        vscodeApi.postMessage({ type: 'revealLogFile' });
    });
    footerTextEl.addEventListener('dblclick', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('footer-filename')) return;
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
var correlationByLineIndex = {};
/* When true, paired "│ … │" banner rows are not stack frames (see isStackFrameText). Baked from host config. */
var viewerPreserveAsciiBoxArt = ${viewerPreserveAsciiBoxArt ? 'true' : 'false'};
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
        if (viewerPreserveAsciiBoxArt && /^\\s*\\u2502\\s+.+\\S\\s*\\u2502\\s*$/.test(plain)) return false;
        return true;
    }
    if (/^package:/.test(trimmed)) return true;          // Dart package paths
    return /^\\s+\\S+\\.\\S+:\\d+/.test(plain);          // Generic: "  pkg.Func:123"
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

if (viewportEl) viewportEl.addEventListener('click', function(e) {
    var badge = e.target.closest('.error-badge-interactive');
    if (badge) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof closeErrorHover === 'function') { closeErrorHover(); }
        var lineEl = badge.closest('[data-idx]');
        if (lineEl) {
            var idx = parseInt(lineEl.dataset.idx, 10);
            var item = allLines[idx];
            if (item) {
                var plain = stripTags(item.html || '');
                vscodeApi.postMessage({ type: 'openErrorAnalysis', text: plain, lineIndex: idx });
            }
        }
        return;
    }
    var urlLink = e.target.closest('.url-link');
    if (urlLink) {
        e.preventDefault();
        vscodeApi.postMessage({ type: 'openUrl', url: urlLink.dataset.url || '' });
        return;
    }
    var burstMk = e.target.closest('.slow-query-burst-marker[data-anchor-seq]');
    if (burstMk) {
        e.preventDefault();
        e.stopPropagation();
        var asq = parseInt(burstMk.getAttribute('data-anchor-seq') || '', 10);
        if (!isNaN(asq) && typeof scrollToAnchorSeq === 'function') scrollToAnchorSeq(asq);
        return;
    }
    /* N+1 insight row actions (see viewer-data-add.ts + drift-n-plus-one-detector.ts). */
    var n1Action = e.target.closest('.n1-action');
    if (n1Action) {
        e.preventDefault();
        e.stopPropagation();
        var action = n1Action.dataset.action || '';
        if (action === 'focus-db' && typeof soloSourceTag === 'function') {
            soloSourceTag('database');
        } else if (action === 'focus-fingerprint') {
            var fp = n1Action.dataset.fingerprint || '';
            var searchInput = document.getElementById('search-input');
            if (searchInput && fp) {
                searchInput.value = fp;
                if (typeof openSearch === 'function') openSearch();
                if (typeof updateSearch === 'function') updateSearch();
            }
        } else if (action === 'find-static-sources') {
            if (typeof staticSqlFromFingerprintEnabled !== 'undefined' && !staticSqlFromFingerprintEnabled) return;
            var fpSrc = n1Action.dataset.fingerprint || '';
            if (fpSrc && typeof vscodeApi !== 'undefined' && vscodeApi) {
                vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpSrc });
            }
        }
        return;
    }
    var sqlStaticBtn = e.target.closest('.sql-repeat-static-sources');
    if (sqlStaticBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof staticSqlFromFingerprintEnabled !== 'undefined' && !staticSqlFromFingerprintEnabled) return;
        var fpStatic = sqlStaticBtn.getAttribute('data-fingerprint') || '';
        if (fpStatic && typeof vscodeApi !== 'undefined' && vscodeApi) {
            vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpStatic });
        }
        return;
    }
    var sqlRepToggle = e.target.closest('.sql-repeat-drilldown-toggle');
    if (sqlRepToggle) {
        e.preventDefault();
        e.stopPropagation();
        var repSeq = parseInt(sqlRepToggle.dataset.seq || '', 10);
        if (!isNaN(repSeq) && typeof toggleSqlRepeatDrilldown === 'function') toggleSqlRepeatDrilldown(repSeq);
        return;
    }
    var driftFoldBtn = e.target.closest('.drift-args-fold-btn');
    if (driftFoldBtn) {
        e.preventDefault();
        e.stopPropagation();
        var driftLine = driftFoldBtn.closest('[data-idx]');
        if (driftLine && driftLine.dataset.idx !== undefined) {
            var dIdx = parseInt(driftLine.dataset.idx, 10);
            if (!isNaN(dIdx) && typeof driftArgsFoldOpenByIdx !== 'undefined') {
                driftArgsFoldOpenByIdx[dIdx] = !driftArgsFoldOpenByIdx[dIdx];
                if (typeof renderViewport === 'function') renderViewport(true);
            }
        }
        return;
    }
    var link = e.target.closest('.source-link');
    if (link) {
        e.preventDefault();
        vscodeApi.postMessage({
            type: 'linkClicked',
            path: link.dataset.path || '',
            line: parseInt(link.dataset.line || '1'),
            col: parseInt(link.dataset.col || '1'),
            splitEditor: e.ctrlKey || e.metaKey,
        });
        return;
    }
    var header = e.target.closest('.stack-header');
    if (header && header.dataset.gid !== undefined) {
        toggleStackGroup(parseInt(header.dataset.gid));
        return;
    }
    var contBadge = e.target.closest('.cont-badge');
    if (contBadge && contBadge.dataset.contGid !== undefined && typeof toggleContinuationGroup === 'function') {
        toggleContinuationGroup(parseInt(contBadge.dataset.contGid));
    }
});

if (viewportEl) viewportEl.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    var lineEl = e.target.closest('[data-idx]');
    if (!lineEl) return;
    var idx = parseInt(lineEl.dataset.idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= allLines.length) return;
    var rItem = allLines[idx];
    if (!rItem || !rItem.sqlRepeatDrilldown || !rItem.sqlRepeatDrilldownOpen) return;
    e.preventDefault();
    if (typeof toggleSqlRepeatDrilldown === 'function') toggleSqlRepeatDrilldown(rItem.seq);
});

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

${getViewerScriptFooterChunk()}

${getViewerScriptMessageHandler()}
${getKeyboardScriptWithDefaults()}

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
            }
        }
    });
}
if (logEl) new ResizeObserver(onLogOrWrapResize).observe(logEl);
if (logWrapEl) new ResizeObserver(onLogOrWrapResize).observe(logWrapEl);
requestAnimationFrame(function() { requestAnimationFrame(syncJumpButtonInset); });
`;
}
