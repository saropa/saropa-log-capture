"use strict";
/**
 * Integration popover sections: database queries, security/audit, and
 * the dedicated "Related Queries" popover.
 *
 * Extracted from the main popover script to keep it under 300 LOC.
 * Each function returns JavaScript code for a section builder that runs
 * in the webview context.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextPopoverDatabaseQueriesScript = getContextPopoverDatabaseQueriesScript;
exports.getRelatedQueriesPopoverScript = getRelatedQueriesPopoverScript;
exports.getContextPopoverSecurityScript = getContextPopoverSecurityScript;
/** Returns the JavaScript for `buildDatabaseQueriesPopoverSection()`. */
function getContextPopoverDatabaseQueriesScript() {
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
/** Returns the JavaScript for the dedicated "Related Queries" popover. */
function getRelatedQueriesPopoverScript() {
    return /* javascript */ `
var relatedQueriesPopoverEl = null;

function closeRelatedQueriesPopover() {
    if (relatedQueriesPopoverEl) {
        relatedQueriesPopoverEl.remove();
        relatedQueriesPopoverEl = null;
    }
}

function buildRelatedQueriesContent(queries) {
    var html = '<div class="popover-header">';
    html += '<span class="popover-title">Related Queries (' + queries.length + ')</span>';
    html += '<button class="popover-close codicon codicon-close" title="Close" aria-label="Close"></button>';
    html += '</div>';
    html += '<div class="popover-body">';
    if (queries.length === 0) {
        html += '<div class="popover-empty">No related queries found</div>';
    } else {
        html += '<div class="popover-section">';
        html += '<div class="popover-section-content">';
        for (var qi = 0; qi < queries.length; qi++) {
            var q = queries[qi];
            var queryShort = q.queryText.length > 80 ? q.queryText.substring(0, 77) + '...' : q.queryText;
            var dur = typeof q.durationMs === 'number' ? ' (' + q.durationMs + 'ms)' : '';
            html += '<div class="popover-item db-query-item">';
            html += '<span class="db-query-text" title="' + popoverEscapeAttr(q.queryText) + '">' + escapeHtmlBasic(queryShort) + '</span>';
            html += '<span class="http-duration">' + escapeHtmlBasic(dur) + '</span>';
            html += ' <button class="popover-copy-query" type="button" data-query="' + popoverEscapeAttr(q.queryText) + '" title="Copy query">\\ud83d\\udccb</button>';
            html += '</div>';
        }
        html += '</div></div>';
    }
    html += '</div>';
    html += '<div class="popover-footer">';
    if (queries.length > 0) {
        html += '<button class="popover-btn rq-copy-all">Copy All</button>';
    }
    html += '</div>';
    return html;
}

function showRelatedQueriesPopover(lineIdx, queries) {
    closeRelatedQueriesPopover();
    closeContextPopover();
    closeQualityPopover();
    var popover = document.createElement('div');
    popover.id = 'related-queries-popover';
    popover.className = 'context-popover';
    popover.innerHTML = buildRelatedQueriesContent(queries);
    document.body.appendChild(popover);
    relatedQueriesPopoverEl = popover;

    var lineEl = document.querySelector('[data-idx="' + lineIdx + '"]');
    var anchorX = 100, anchorY = 100;
    if (lineEl) {
        var rect = lineEl.getBoundingClientRect();
        anchorX = rect.left + 20;
        anchorY = rect.bottom;
    }
    var pRect = popover.getBoundingClientRect();
    var left = anchorX + 10;
    var top = anchorY + 10;
    if (left + pRect.width > window.innerWidth - 20) left = window.innerWidth - pRect.width - 20;
    if (top + pRect.height > window.innerHeight - 20) top = anchorY - pRect.height - 10;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    var closeBtn = popover.querySelector('.popover-close');
    if (closeBtn) closeBtn.addEventListener('click', function(e) { e.stopPropagation(); closeRelatedQueriesPopover(); });

    attachPopoverDataBtnHandlers(popover, '.popover-copy-query', 'data-query', function(val) {
        vscodeApi.postMessage({ type: 'copyToClipboard', text: val });
    });

    var copyAllBtn = popover.querySelector('.rq-copy-all');
    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var allSql = [];
            for (var i = 0; i < queries.length; i++) allSql.push(queries[i].queryText);
            vscodeApi.postMessage({ type: 'copyToClipboard', text: allSql.join('\\n') });
            showPopoverToast('Copied ' + queries.length + ' queries');
        });
    }

    setTimeout(function() {
        document.addEventListener('click', function onOut(e) {
            if (relatedQueriesPopoverEl && !relatedQueriesPopoverEl.contains(e.target)) {
                document.removeEventListener('click', onOut);
                closeRelatedQueriesPopover();
            }
        });
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onEsc);
                closeRelatedQueriesPopover();
            }
        });
    }, 0);
}

function handleRelatedQueriesPopoverData(msg) {
    if (msg.error) {
        showPopoverToast(msg.error);
        return;
    }
    showRelatedQueriesPopover(msg.lineIndex || 0, msg.queries || []);
}

window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'relatedQueriesData') {
        handleRelatedQueriesPopoverData(msg);
    }
    if (msg.type === 'triggerShowRelatedQueries') {
        var rqIdx = typeof focusedLineIdx !== 'undefined' && focusedLineIdx >= 0 ? focusedLineIdx : -1;
        if (rqIdx < 0 || rqIdx >= allLines.length) { showPopoverToast('No line selected'); return; }
        var rqLd = allLines[rqIdx];
        vscodeApi.postMessage({ type: 'showRelatedQueries', lineIndex: rqIdx, timestamp: rqLd.ts || rqLd.timestamp, lineText: stripTags(rqLd.html || '') });
    }
});
`;
}
/** Returns the JavaScript for `buildSecurityPopoverSection()`. */
function getContextPopoverSecurityScript() {
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
//# sourceMappingURL=viewer-context-popover-integration-sections.js.map