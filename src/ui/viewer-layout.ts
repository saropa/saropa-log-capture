/**
 * Viewer Layout Script
 *
 * Provides dynamic layout adjustments for the log viewer:
 * - Font size control (8-22px)
 * - Line height control (0.5-4.0)
 * - Dynamic ROW_HEIGHT measurement via hidden probe element
 * - Updates CSS variables and triggers viewport recalculation
 */

/**
 * Returns the JavaScript code for layout controls in the webview.
 */
export function getLayoutScript(): string {
    return /* javascript */ `
/** Current font size in pixels. */
var logFontSize = 13;

/** Current line height multiplier. */
var logLineHeight = 2.0;

/** Enable visual spacing (breathing room) between sections. */
var visualSpacingEnabled = true;

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
 * @param {number} size - Font size in pixels (8-22)
 */
function setFontSize(size) {
    logFontSize = Math.max(8, Math.min(22, size));
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

/**
 * Toggle visual spacing on/off.
 */
function toggleVisualSpacing() {
    visualSpacingEnabled = !visualSpacingEnabled;
    if (typeof renderViewport === 'function') {
        renderViewport(true);
    }
}

// Initialize CSS variables on load
document.documentElement.style.setProperty('--log-font-size', logFontSize + 'px');
document.documentElement.style.setProperty('--log-line-height', logLineHeight.toString());

// Measure actual row height after all CSS is applied
requestAnimationFrame(function() { measureRowHeight(); });

// Ctrl+scroll to zoom font size
var _logContentEl = document.getElementById('log-content');
if (_logContentEl) {
    _logContentEl.addEventListener('wheel', function(e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setFontSize(logFontSize + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
}
`;
}
