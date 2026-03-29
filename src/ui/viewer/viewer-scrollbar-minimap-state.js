"use strict";
/**
 * Minimap state variables, setting handlers, and proportional-width helpers.
 * Concatenated before paint + interaction code in the webview bundle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScrollbarMinimapStateScript = getScrollbarMinimapStateScript;
/** Returns minimap state declarations, settings handlers, and proportional-width helpers. */
function getScrollbarMinimapStateScript() {
    return /* javascript */ `
var minimapEl = null;
var mmCanvas = null;
var mmCtx = null;
var mmViewport = null;
var mmDragging = false;
var minimapDebounceTimer = 0;
var mmColors = {};
var mmShowInfo = false;
var mmShowSqlDensity = true;
/** When true (default), marker width ≈ min(100%, line length / reference line length); see mmBarWidthFrac. */
var mmProportionalLines = true;
var mmWidthPx = 60;
var mmViewportRedOutline = false;
var mmOutsideArrowEnabled = false;
var mmOutsideArrowEl = null;
var mmOutsideArrowGlyph = null;
var MM_OUTSIDE_ARROW_STRIP_PX = 12;

/** Total horizontal width of minimap column + optional outside arrow (for --mm-w and jump/replay inset). */
function syncMmColumnWidth() {
    var wrapper = document.getElementById('log-content-wrapper');
    if (wrapper) {
        var arrowPx = (mmOutsideArrowEnabled && mmOutsideArrowEl && !mmOutsideArrowEl.classList.contains('u-hidden')) ? MM_OUTSIDE_ARROW_STRIP_PX : 0;
        wrapper.style.setProperty('--mm-w', (arrowPx + mmWidthPx) + 'px');
    }
    if (typeof syncJumpButtonInset === 'function') syncJumpButtonInset();
}

/** Handle minimapShowInfo setting message from extension. */
function handleMinimapShowInfo(msg) {
    var prev = mmShowInfo;
    mmShowInfo = !!msg.show;
    if (prev !== mmShowInfo) scheduleMinimap();
}

/** Handle minimapWidth setting message from extension. */
function handleMinimapWidth(msg) {
    if (!minimapEl) return;
    var sizes = { xsmall: 28, small: 40, medium: 60, large: 90, xlarge: 120 };
    mmWidthPx = sizes[msg.width] || 60;
    minimapEl.style.width = mmWidthPx + 'px';
    syncMmColumnWidth();
    if (typeof minimapWidthSetting !== 'undefined') minimapWidthSetting = msg.width || 'medium';
    if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
}

/** Optional strong red border on the viewport rectangle (settings: minimapViewportRedOutline). */
function handleMinimapViewportRedOutline(msg) {
    mmViewportRedOutline = msg.show === true;
    if (mmViewport) mmViewport.classList.toggle('minimap-viewport--red-outline', mmViewportRedOutline);
}

/** Optional yellow arrow strip left of the minimap (settings: minimapViewportOutsideArrow). */
function handleMinimapViewportOutsideArrow(msg) {
    mmOutsideArrowEnabled = msg.show === true;
    if (mmOutsideArrowEl) mmOutsideArrowEl.classList.toggle('u-hidden', !mmOutsideArrowEnabled);
    syncMmColumnWidth();
    updateMinimapViewport();
}

/** Handle minimapShowSqlDensity setting message from extension/options UI. */
function handleMinimapShowSqlDensity(msg) {
    var prev = mmShowSqlDensity;
    mmShowSqlDensity = msg.show !== false;
    if (prev !== mmShowSqlDensity) scheduleMinimap();
}

/** minimapProportionalLines setting: narrow bars by text length vs log pane width (VS Code–style silhouette). */
function handleMinimapProportionalLines(msg) {
    var next = msg.show !== false;
    if (next === mmProportionalLines) return;
    mmProportionalLines = next;
    scheduleMinimap();
}

/**
 * Approximate how many characters fit on one row of #log-content at the current width.
 * Fixed average char width — good enough for a minimap silhouette; updates on resize.
 */
function mmCharsPerContentLine() {
    var lc = document.getElementById('log-content');
    var w = lc && lc.clientWidth > 0 ? lc.clientWidth : 400;
    w = Math.max(24, w);
    var perChar = 7.15;
    return Math.max(8, Math.floor(w / perChar));
}

/**
 * Width fraction (0–1] for one logical line: text length vs one reference row, capped at 100%.
 * With word wrap on, lines longer than one row count as full width (they span the pane).
 */
function mmBarWidthFrac(it) {
    if (!mmProportionalLines) return 1;
    var plain = stripTags(it.html || '');
    var len = plain.length;
    var ref = mmCharsPerContentLine();
    if (ref < 1) ref = 1;
    var wrapOn = (typeof wordWrap !== 'undefined' && wordWrap);
    var raw = !wrapOn ? (len / ref) : (len <= ref ? (len / ref) : 1);
    var frac = Math.min(1, raw);
    if (len === 0) frac = Math.max(frac, 0.06);
    return Math.max(0.02, frac);
}
`;
}
//# sourceMappingURL=viewer-scrollbar-minimap-state.js.map