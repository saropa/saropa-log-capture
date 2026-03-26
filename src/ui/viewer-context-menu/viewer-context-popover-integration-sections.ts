/**
 * Integration popover sections: database queries and security/audit.
 *
 * Extracted from the main popover script to keep it under 300 LOC.
 * Each function returns JavaScript code for a section builder that runs
 * in the webview context.
 */

/** Returns the JavaScript for `buildDatabaseQueriesPopoverSection()`. */
export function getContextPopoverDatabaseQueriesScript(): string {
    return /* javascript */ `
function buildDatabaseQueriesPopoverSection(data) {
    if (!data || !data.data || !data.data.database || data.data.database.length === 0) {
        return '';
    }
    var items = data.data.database;
    var html = '<div class="popover-section">';
    html += '<div class="popover-section-header"><span class="popover-icon">\\ud83d\\uddc3</span> Queries (' + items.length + ')</div>';
    html += '<div class="popover-section-content">';
    var shown = items.slice(0, 5);
    for (var qi = 0; qi < shown.length; qi++) {
        var q = shown[qi];
        var queryShort = q.queryText.length > 50 ? q.queryText.substring(0, 47) + '...' : q.queryText;
        var dur = typeof q.durationMs === 'number' ? ' (' + q.durationMs + 'ms)' : '';
        html += '<div class="popover-item db-query-item">';
        html += '<span class="db-query-text" title="' + popoverEscapeAttr(q.queryText) + '">' + escapeHtmlBasic(queryShort) + '</span>';
        html += '<span class="http-duration">' + escapeHtmlBasic(dur) + '</span>';
        html += ' <button class="popover-copy-query" type="button" data-query="' + popoverEscapeAttr(q.queryText) + '" title="Copy query">\\ud83d\\udccb</button>';
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

/** Returns the JavaScript for `buildSecurityPopoverSection()`. */
export function getContextPopoverSecurityScript(): string {
    return /* javascript */ `
function buildSecurityPopoverSection(data) {
    var secMeta = data && data.data && data.data.integrationsMeta && data.data.integrationsMeta.security;
    if (!secMeta || typeof secMeta !== 'object') { return ''; }
    var html = '<div class="popover-section">';
    html += '<div class="popover-section-header"><span class="popover-icon">\\ud83d\\udd12</span> Security / Audit</div>';
    html += '<div class="popover-section-content">';
    html += '<div class="popover-item popover-security-note">Security events are not shown inline.</div>';
    if (secMeta.summary) {
        html += '<div class="popover-item">' + escapeHtmlBasic(String(secMeta.summary)) + '</div>';
    }
    if (secMeta.securitySidecar) {
        html += '<button class="popover-btn popover-open-sidecar" type="button" data-file="' + popoverEscapeAttr(String(secMeta.securitySidecar)) + '">Open events file</button>';
    }
    if (secMeta.auditSidecar) {
        html += '<button class="popover-btn popover-open-sidecar" type="button" data-file="' + popoverEscapeAttr(String(secMeta.auditSidecar)) + '">Open audit file</button>';
    }
    html += '</div></div>';
    return html;
}
`;
}
