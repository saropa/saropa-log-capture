/**
 * Viewer Layout Script
 *
 * Provides dynamic layout adjustments for the log viewer:
 * - Font size control (8-22px)
 * - Line height control (0.5-4.0)
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
var logLineHeight = 1.5;

/** Enable visual spacing (breathing room) between sections. */
var visualSpacingEnabled = false;

/**
 * Set the font size for all log lines.
 * @param {number} size - Font size in pixels (8-22)
 */
function setFontSize(size) {
    logFontSize = Math.max(8, Math.min(22, size));
    document.documentElement.style.setProperty('--log-font-size', logFontSize + 'px');

    // Recalculate heights and re-render viewport
    if (typeof recalcHeights === 'function') {
        recalcHeights();
    }
    if (typeof renderViewport === 'function') {
        renderViewport(true);
    }
}

/**
 * Set the line height for all log lines.
 * @param {number} height - Line height multiplier (0.5-4.0)
 */
function setLineHeight(height) {
    logLineHeight = Math.max(0.5, Math.min(4.0, height));
    document.documentElement.style.setProperty('--log-line-height', logLineHeight.toString());

    // Recalculate heights and re-render viewport
    if (typeof recalcHeights === 'function') {
        recalcHeights();
    }
    if (typeof renderViewport === 'function') {
        renderViewport(true);
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
`;
}
