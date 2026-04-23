/**
 * Viewer Layout Script (embedded webview JavaScript)
 *
 * Emits the first script block in the viewer bundle (see `viewer-content-scripts.ts` order). It runs
 * before virtual-scroll / data scripts and defines global layout state and helpers consumed by
 * options UI, context menu actions, and streak/suggestion logic.
 *
 * Responsibilities:
 * - **Typography:** `logFontSize`, `logLineHeight`, CSS variables `--log-font-size` / `--log-line-height`,
 *   and `measureRowHeight()` (hidden probe) so `ROW_HEIGHT` / `MARKER_HEIGHT` match themed CSS.
 * - **Line presentation:** `visualSpacingEnabled`, `hideBlankLines`, and two compression modes:
 *   `compressLinesMode` (consecutive dupes) and `compressNonConsecutiveMode` (global dupes).
 * - **Compress UI sync:** `toggleCompressLines()` flips `compressLinesMode` and re-renders via
 *   `recalcAndRender` / `recalcHeights` + `renderViewport` so Options panel checkbox and context menu
 *   stay aligned.
 * - **Suggestion banner:** `showCompressSuggestionBanner` / `hideCompressSuggestionBanner` coordinate
 *   with `viewer-data-compress-streak.ts` when compress is off and many identical lines stream in.
 * - **Input:** Ctrl/Meta + wheel on `#log-content` adjusts font size.
 *
 * **Ordering / safety:** Do not call into data-layer functions before they exist; helpers use
 * `typeof fn === 'function'` guards. Compression modes are plain booleans — no async or recursion.
 */

/**
 * Returns the JavaScript code for layout controls in the webview.
 */
export function getLayoutScript(): string {
    return /* javascript */ `
/** Current font size in pixels. */
var logFontSize = 13;

/**
 * Reset target for the font size — what Ctrl+0 / fontSizeReset returns to.
 * Updated by the setLogFontSize host message so reset follows the user's configured setting,
 * not the hard-coded fallback. Keep in sync with package.json "saropaLogCapture.logFontSize" default.
 */
var logFontSizeDefault = 13;

/**
 * Current line height multiplier.
 *
 * Default 1.1 (was 2.0) after users flagged ~0.5em of visible whitespace between rows in dense
 * logs — that was the 0.5em leading produced by the old line-height: 1.5 CSS fallback. 1.1 keeps
 * descenders/ascenders from clipping in monospace while eliminating the intra-line gap.
 * Must stay in sync with the CSS fallback in viewer-styles-lines.ts and the package.json default.
 */
var logLineHeight = 1.1;

/** Reset target for the line height — what Ctrl+Shift+0 / lineHeightReset returns to. */
var logLineHeightDefault = 1.1;

/** Enable visual spacing (breathing room) between sections. */
var visualSpacingEnabled = true;

/** Hide lines that are empty or only whitespace. */
var hideBlankLines = false;

/** Collapse consecutive duplicate log lines to one row with a count badge. */
var compressLinesMode = false;

/** Collapse non-consecutive duplicate log lines globally with a count badge on the first instance. */
var compressNonConsecutiveMode = false;

/**
 * Measure actual line height from the DOM and update ROW_HEIGHT / MARKER_HEIGHT.
 * Uses a hidden probe element with the same CSS class as log lines.
 */
function measureRowHeight() {
    var probe = document.getElementById('height-probe');
    if (!probe) {
        probe = document.createElement('div');
        probe.id = 'height-probe';
        probe.className = 'line';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.top = '-9999px';
        probe.textContent = 'Xg';
        document.body.appendChild(probe);
    }
    var rect = probe.getBoundingClientRect();
    if (rect.height > 0) {
        ROW_HEIGHT = Math.ceil(rect.height);
        MARKER_HEIGHT = Math.ceil(ROW_HEIGHT * 1.4);
    }
}

/**
 * Set the font size for all log lines.
 * @param {number} size - Font size in pixels (4-42)
 */
function setFontSize(size) {
    logFontSize = Math.max(4, Math.min(42, size));
    document.documentElement.style.setProperty('--log-font-size', logFontSize + 'px');
    measureRowHeight();
    if (typeof recalcAndRender === 'function') {
        recalcAndRender();
    } else {
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof renderViewport === 'function') renderViewport(true);
    }
}

/**
 * Set the line height for all log lines.
 * @param {number} height - Line height multiplier (0.5-4.0)
 */
function setLineHeight(height) {
    logLineHeight = Math.max(0.5, Math.min(4.0, height));
    document.documentElement.style.setProperty('--log-line-height', logLineHeight.toString());
    measureRowHeight();
    if (typeof recalcAndRender === 'function') {
        recalcAndRender();
    } else {
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof renderViewport === 'function') renderViewport(true);
    }
}

/** Line height presets: compressed (tight) vs comfortable (breathing room). */
var LINE_HEIGHT_COMPRESSED = 1.2;
var LINE_HEIGHT_COMFORTABLE = 2.0;

/**
 * Toggle line height between compressed and comfortable.
 */
function toggleLineHeightMode() {
    var target = logLineHeight >= 1.5 ? LINE_HEIGHT_COMPRESSED : LINE_HEIGHT_COMFORTABLE;
    setLineHeight(target);
}

/**
 * Toggle visual spacing on/off.
 */
function toggleVisualSpacing() {
    visualSpacingEnabled = !visualSpacingEnabled;
    if (typeof renderViewport === 'function') {
        renderViewport(true);
    }
}

/**
 * Toggle hide blank lines on/off.
 */
function toggleHideBlankLines() {
    hideBlankLines = !hideBlankLines;
    if (typeof recalcAndRender === 'function') recalcAndRender();
    else {
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof renderViewport === 'function') renderViewport(true);
    }
}

function hideCompressSuggestionBanner() {
    var b = document.getElementById('compress-suggest-banner');
    var w = document.getElementById('session-nav-wrapper');
    if (b) b.classList.add('u-hidden');
    if (w) w.classList.remove('compress-suggest-visible');
}

/** Shown when streaming detects many consecutive duplicate lines (see viewer-data streak). */
function showCompressSuggestionBanner() {
    if ((typeof compressLinesMode !== 'undefined' && compressLinesMode)
        || (typeof compressNonConsecutiveMode !== 'undefined' && compressNonConsecutiveMode)) return;
    var b = document.getElementById('compress-suggest-banner');
    var w = document.getElementById('session-nav-wrapper');
    if (b) b.classList.remove('u-hidden');
    if (w) w.classList.add('compress-suggest-visible');
}

/**
 * Toggle compress lines: collapse runs of identical consecutive log lines
 * to the last line with a repeat count badge.
 */
function toggleCompressLines() {
    compressLinesMode = !compressLinesMode;
    if (compressLinesMode && typeof compressNonConsecutiveMode !== 'undefined') compressNonConsecutiveMode = false;
    if (!compressLinesMode && typeof compressNonConsecutiveMode !== 'undefined' && !compressNonConsecutiveMode) hideCompressSuggestionBanner();
    if (compressLinesMode) hideCompressSuggestionBanner();
    if (typeof recalcAndRender === 'function') recalcAndRender();
    else {
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof renderViewport === 'function') renderViewport(true);
    }
}

/**
 * Toggle global dedupe: collapse identical non-consecutive log lines to the first
 * line with a repeat count badge.
 */
function toggleCompressNonConsecutiveLines() {
    compressNonConsecutiveMode = !compressNonConsecutiveMode;
    if (compressNonConsecutiveMode && typeof compressLinesMode !== 'undefined') compressLinesMode = false;
    if (!compressNonConsecutiveMode && typeof compressLinesMode !== 'undefined' && !compressLinesMode) hideCompressSuggestionBanner();
    if (compressNonConsecutiveMode) hideCompressSuggestionBanner();
    if (typeof recalcAndRender === 'function') recalcAndRender();
    else {
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof renderViewport === 'function') renderViewport(true);
    }
}

// Initialize CSS variables on load
document.documentElement.style.setProperty('--log-font-size', logFontSize + 'px');
document.documentElement.style.setProperty('--log-line-height', logLineHeight.toString());

// Measure actual row height after all CSS is applied
requestAnimationFrame(function() { measureRowHeight(); });

/*
 * Typography wheel gestures on #log-content:
 *  - Ctrl/Meta + wheel        → font size ±1 px
 *  - Ctrl/Meta + Shift + wheel → line height ±0.1
 *
 * Shift is checked first so Ctrl+Shift+wheel does not also fire the font-size branch.
 * Step size 0.1 matches the keyboard shortcuts lineHeightUp/Down for consistency.
 */
var _logContentEl = document.getElementById('log-content');
if (_logContentEl) {
    _logContentEl.addEventListener('wheel', function(e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        if (e.shiftKey) {
            /* 0.1 * ±1 and round to 1 decimal to avoid 1.1 + 0.1 => 1.2000000000000002 drift. */
            var next = Math.round((logLineHeight + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10;
            setLineHeight(next);
            return;
        }
        setFontSize(logFontSize + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
}
`;
}
