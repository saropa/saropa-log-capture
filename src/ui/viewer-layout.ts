/**
 * Viewer Layout Script
 *
 * Provides dynamic layout adjustments for the log viewer:
 * - Font size control (10-20px)
 * - Line height control (1.0-2.5)
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
 * @param {number} size - Font size in pixels (10-20)
 */
function setFontSize(size) {
    logFontSize = Math.max(10, Math.min(20, size));
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
 * @param {number} height - Line height multiplier (1.0-2.5)
 */
function setLineHeight(height) {
    logLineHeight = Math.max(1.0, Math.min(2.5, height));
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
