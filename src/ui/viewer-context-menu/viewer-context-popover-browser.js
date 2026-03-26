"use strict";
/**
 * Browser events popover section builder.
 *
 * Renders browser console events (level, message, optional URL) from
 * the context popover data. Shows up to 5 events with a "... and N more" overflow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextPopoverBrowserScript = getContextPopoverBrowserScript;
/** Returns the JavaScript for `buildBrowserPopoverSection()`. */
function getContextPopoverBrowserScript() {
    return /* javascript */ `
function buildBrowserPopoverSection(data) {
    if (!data || !data.data || !data.data.browser || data.data.browser.length === 0) {
        return '';
    }
    var items = data.data.browser;
    var html = '<div class="popover-section">';
    html += '<div class="popover-section-header"><span class="popover-icon">\\ud83c\\udf10</span> Browser (' + items.length + ' event' + (items.length > 1 ? 's' : '') + ')</div>';
    html += '<div class="popover-section-content">';
    var shown = items.slice(0, 5);
    for (var i = 0; i < shown.length; i++) {
        var evt = shown[i];
        var lvl = evt.level || 'log';
        var icon = lvl.indexOf('error') >= 0 ? '\\u25cf' : (lvl.indexOf('warn') >= 0 ? '\\u26a0' : '\\u25cb');
        var levelClass = lvl.indexOf('error') >= 0 ? 'status-error' : (lvl.indexOf('warn') >= 0 ? 'status-redirect' : '');
        var msg = evt.message || '';
        if (msg.length > 60) msg = msg.substring(0, 57) + '...';
        html += '<div class="popover-item">';
        html += '<span class="' + levelClass + '">' + icon + '</span> ';
        html += escapeHtmlBasic(msg);
        if (evt.url) {
            var shortUrl = evt.url.length > 30 ? evt.url.substring(0, 27) + '...' : evt.url;
            html += ' <span class="http-url">(' + escapeHtmlBasic(shortUrl) + ')</span>';
        }
        html += '</div>';
    }
    if (items.length > 5) {
        html += '<div class="popover-more">... and ' + (items.length - 5) + ' more</div>';
    }
    html += '</div></div>';
    return html;
}
`;
}
//# sourceMappingURL=viewer-context-popover-browser.js.map