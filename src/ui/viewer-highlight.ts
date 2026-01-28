/**
 * Viewer Highlight Script
 *
 * Handles pattern-based highlighting of log lines in the webview.
 * Receives compiled highlight rules from the extension and applies
 * them during line rendering.
 *
 * Integration points:
 * - Extension sends rules via 'setHighlightRules' message
 * - renderItem() calls applyHighlightStyles() to add CSS
 * - Tooltips show labels of matching rules on hover
 */

/**
 * Returns the JavaScript code for highlight rule processing in the webview.
 * This code executes in the webview context and applies highlight styles
 * to matching log lines during rendering.
 */
export function getHighlightScript(): string {
    return /* javascript */ `
/**
 * Compiled highlight rules received from the extension.
 * Each rule has: { pattern: string, flags: string, color?, backgroundColor?, fontWeight?, fontStyle?, label }
 * Compiled to RegExp objects for efficient matching.
 */
var highlightRules = [];

/**
 * Handles the setHighlightRules message from the extension.
 * Compiles string patterns to RegExp objects for efficient matching.
 *
 * @param {Object} msg - Message containing serialized highlight rules
 * @param {Array} msg.rules - Array of rule objects with pattern, flags, and style info
 */
function handleSetHighlightRules(msg) {
    highlightRules = [];
    if (!msg.rules || !Array.isArray(msg.rules)) {
        renderViewport(true);
        return;
    }

    for (var i = 0; i < msg.rules.length; i++) {
        var r = msg.rules[i];
        try {
            var regex = new RegExp(r.pattern, r.flags || '');
            highlightRules.push({
                regex: regex,
                color: r.color,
                backgroundColor: r.backgroundColor,
                fontWeight: r.fontWeight,
                fontStyle: r.fontStyle,
                label: r.label || r.pattern,
            });
        } catch (e) {
            // Invalid regex - skip this rule
            console.warn('Invalid highlight pattern:', r.pattern, e);
        }
    }

    // Re-render viewport to apply new highlight rules
    if (typeof renderViewport === 'function') {
        renderViewport(true);
    }
}

/**
 * Matches a line's plain text against all highlight rules.
 * Returns the combined styles and matched labels for tooltip display.
 *
 * Multiple rules can match the same line. For conflicting style properties
 * (e.g., two rules setting different colors), the first matching rule wins.
 * All matching labels are collected for the tooltip.
 *
 * @param {string} text - Plain text of the log line (HTML stripped)
 * @returns {Object|null} - { style: string, labels: string[] } or null if no match
 */
function matchHighlightRules(text) {
    if (highlightRules.length === 0) {
        return null;
    }

    var color = null;
    var backgroundColor = null;
    var fontWeight = null;
    var fontStyle = null;
    var labels = [];

    for (var i = 0; i < highlightRules.length; i++) {
        var rule = highlightRules[i];
        if (rule.regex.test(text)) {
            labels.push(rule.label);
            // First match wins for each style property
            if (rule.color && !color) { color = rule.color; }
            if (rule.backgroundColor && !backgroundColor) { backgroundColor = rule.backgroundColor; }
            if (rule.fontWeight && !fontWeight) { fontWeight = rule.fontWeight; }
            if (rule.fontStyle && !fontStyle) { fontStyle = rule.fontStyle; }
        }
    }

    if (labels.length === 0) {
        return null;
    }

    // Build inline CSS style string
    var styleParts = [];
    if (color) { styleParts.push('color: ' + color); }
    if (backgroundColor) { styleParts.push('background-color: ' + backgroundColor); }
    if (fontWeight) { styleParts.push('font-weight: ' + fontWeight); }
    if (fontStyle) { styleParts.push('font-style: ' + fontStyle); }

    return {
        style: styleParts.length > 0 ? styleParts.join('; ') + ';' : '',
        labels: labels,
    };
}

/**
 * Applies highlight styles to a line element's HTML.
 * Called by renderItem() when building the line HTML.
 *
 * Wraps the content in a span with inline styles if any rules match.
 * Also adds a title attribute for tooltip showing matching rule labels.
 *
 * @param {string} html - The rendered HTML content of the line
 * @param {string} plainText - Plain text for pattern matching (HTML stripped)
 * @returns {Object} - { html: string, titleAttr: string } with modified html and title attribute
 */
function applyHighlightStyles(html, plainText) {
    var match = matchHighlightRules(plainText);
    if (!match || match.style === '') {
        return { html: html, titleAttr: '' };
    }

    // Wrap in styled span and add tooltip with matching rule labels
    var escapedLabels = match.labels.join(', ').replace(/"/g, '&quot;');
    var wrappedHtml = '<span class="highlight-match" style="' + match.style + '">' + html + '</span>';

    return {
        html: wrappedHtml,
        titleAttr: ' title="Highlights: ' + escapedLabels + '"',
    };
}

// Register message handler for highlight rules
// (runs after main script - listens for setHighlightRules messages from extension)
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'setHighlightRules') {
        handleSetHighlightRules(msg);
    }
});
`;
}
