/**
 * Context Popover Script
 *
 * Displays a floating popover with integration context data (performance,
 * HTTP requests, terminal output, etc.) filtered to ±N seconds around
 * a clicked log line. Triggered from the context menu "Show Integration Context".
 *
 * ## Database signal (line-local)
 *
 * Rows with `sourceTag === 'database'` (Drift `Sent` SQL) carry `dbSignal` from the data layer
 * (fingerprint, session seen-count, optional avg/max `elapsedMs`, `sqlSnippet`). The embedded
 * `buildDatabaseSignalPopoverSection` function renders only when `row.dbSignal` exists; non-DB lines never get that section. SQL is truncated in the body with
 * the full string on `title` for hover/copy; fingerprint uses the same pattern.
 *
 * ## Drift Advisor CTA
 *
 * "Open in Drift Advisor" appears only when `window.driftAdvisorAvailable` is true (set from the extension host).
 * Multiple buttons (Database signal + session Drift meta) share the class `popover-drift-open`; handlers use
 * `querySelectorAll` so each fires `openDriftAdvisor`.
 */

import { getContextPopoverBrowserScript } from './viewer-context-popover-browser';
import { getContextPopoverDbSignalScript } from './viewer-context-popover-db-signal';
import { getContextPopoverDatabaseQueriesScript, getContextPopoverSecurityScript, getRelatedQueriesPopoverScript } from './viewer-context-popover-integration-sections';
import { getContextPopoverSharedScript } from './viewer-context-popover-shared-script';
import { getQualityPopoverScript } from './viewer-quality-popover-script';

/**
 * Returns the JavaScript code for the context popover in the webview.
 */
export function getContextPopoverScript(): string {
    return getContextPopoverBrowserScript() + getContextPopoverDbSignalScript() + getContextPopoverDatabaseQueriesScript() + getContextPopoverSecurityScript() + getRelatedQueriesPopoverScript() + (
        /* javascript */ `
var contextPopoverEl = null;
var contextPopoverLineIdx = -1;

function showContextPopover(lineIdx, anchorX, anchorY, data) {
    closeContextPopover();
    closeRelatedQueriesPopover();
    contextPopoverLineIdx = lineIdx;

    var popover = document.createElement('div');
    popover.id = 'context-popover';
    popover.className = 'context-popover';
    popover.innerHTML = buildPopoverContent(lineIdx, data);

    document.body.appendChild(popover);
    contextPopoverEl = popover;

    // Position the popover near the anchor point
    var rect = popover.getBoundingClientRect();
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;

    var left = anchorX + 10;
    var top = anchorY + 10;

    // Keep within viewport bounds
    if (left + rect.width > viewportWidth - 20) {
        left = viewportWidth - rect.width - 20;
    }
    if (top + rect.height > viewportHeight - 20) {
        top = anchorY - rect.height - 10;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    // Attach event handlers
    var closeBtn = popover.querySelector('.popover-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeContextPopover();
        });
    }

    var copyBtn = popover.querySelector('.popover-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            copyPopoverContent();
        });
    }

    var fullBtn = popover.querySelector('.popover-full');
    if (fullBtn) {
        fullBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            vscodeApi.postMessage({ type: 'openFullIntegrationContext', lineIndex: lineIdx });
            closeContextPopover();
        });
    }

    var driftBtns = popover.querySelectorAll('.popover-drift-open');
    for (var dbi = 0; dbi < driftBtns.length; dbi++) {
        driftBtns[dbi].addEventListener('click', function(e) {
            e.stopPropagation();
            vscodeApi.postMessage({ type: 'openDriftAdvisor' });
            closeContextPopover();
        });
    }

    var staticSqlBtns = popover.querySelectorAll('.popover-static-sql-open');
    for (var ssi = 0; ssi < staticSqlBtns.length; ssi++) {
        staticSqlBtns[ssi].addEventListener('click', function(e) {
            e.stopPropagation();
            var btn = e.currentTarget;
            var fp = btn && btn.getAttribute('data-fingerprint') ? btn.getAttribute('data-fingerprint') : '';
            if (fp && typeof vscodeApi !== 'undefined' && vscodeApi) {
                vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fp });
            }
            closeContextPopover();
        });
    }

    attachPopoverDataBtnHandlers(popover, '.popover-copy-query', 'data-query', function(val) {
        vscodeApi.postMessage({ type: 'copyToClipboard', text: val });
    });
    attachPopoverDataBtnHandlers(popover, '.popover-open-sidecar', 'data-file', function(val) {
        vscodeApi.postMessage({ type: 'openSidecarFile', filename: val });
        closeContextPopover();
    });

    // Close on click outside
    setTimeout(function() {
        document.addEventListener('click', onPopoverOutsideClick);
        document.addEventListener('keydown', onPopoverEscape);
    }, 0);
}

function onPopoverOutsideClick(e) {
    if (contextPopoverEl && !contextPopoverEl.contains(e.target)) {
        closeContextPopover();
    }
}

function onPopoverEscape(e) {
    if (e.key === 'Escape') {
        closeContextPopover();
    }
}

function closeContextPopover() {
    document.removeEventListener('click', onPopoverOutsideClick);
    document.removeEventListener('keydown', onPopoverEscape);
    if (contextPopoverEl) {
        contextPopoverEl.remove();
        contextPopoverEl = null;
    }
    contextPopoverLineIdx = -1;
}

function popoverEscapeAttr(text) {
    return escapeHtmlBasic(text).replace(/"/g, '&quot;');
}

function buildPopoverContent(lineIdx, data) {
    var windowMs = data.windowMs || 5000;
    var windowSec = Math.round(windowMs / 1000);
    var timestamp = data.timestamp;
    var timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : 'unknown';

    var html = '<div class="popover-header">';
    html += '<span class="popover-title">Context at ' + timeStr + ' (\\u00b1' + windowSec + 's)</span>';
    html += '<button class="popover-close codicon codicon-close" title="Close" aria-label="Close"></button>';
    html += '</div>';
    html += '<div class="popover-body">';

    var hasContent = false;

    // Performance section
    if (data.data && data.data.performance && data.data.performance.length > 0) {
        hasContent = true;
        html += '<div class="popover-section">';
        html += '<div class="popover-section-header"><span class="popover-icon">\\u26a1</span> Performance</div>';
        html += '<div class="popover-section-content">';
        var perf = data.data.performance;
        if (perf.length >= 2) {
            var first = perf[0];
            var last = perf[perf.length - 1];
            var memDelta = last.freeMemMb - first.freeMemMb;
            var sign = memDelta >= 0 ? '+' : '';
            html += '<div class="popover-item">Memory: ' + first.freeMemMb + 'MB \\u2192 ' + last.freeMemMb + 'MB (' + sign + memDelta + 'MB)</div>';
            if (first.loadAvg1 !== undefined && last.loadAvg1 !== undefined) {
                html += '<div class="popover-item">CPU load: ' + first.loadAvg1.toFixed(2) + ' \\u2192 ' + last.loadAvg1.toFixed(2) + '</div>';
            }
        } else if (perf.length === 1) {
            html += '<div class="popover-item">Memory: ' + perf[0].freeMemMb + 'MB free</div>';
            if (perf[0].loadAvg1 !== undefined) {
                html += '<div class="popover-item">CPU load: ' + perf[0].loadAvg1.toFixed(2) + '</div>';
            }
        }
        html += '</div></div>';
    }

    // HTTP section
    if (data.data && data.data.http && data.data.http.length > 0) {
        hasContent = true;
        html += '<div class="popover-section">';
        html += '<div class="popover-section-header"><span class="popover-icon">\\ud83c\\udf10</span> HTTP (' + data.data.http.length + ' request' + (data.data.http.length > 1 ? 's' : '') + ')</div>';
        html += '<div class="popover-section-content">';
        var httpItems = data.data.http.slice(0, 5);
        for (var i = 0; i < httpItems.length; i++) {
            var req = httpItems[i];
            var statusClass = req.status >= 400 ? 'status-error' : (req.status >= 300 ? 'status-redirect' : 'status-ok');
            var url = req.url.length > 40 ? req.url.substring(0, 37) + '...' : req.url;
            html += '<div class="popover-item http-item">';
            html += '<span class="http-method">' + escapeHtmlBasic(req.method) + '</span> ';
            html += '<span class="http-url">' + escapeHtmlBasic(url) + '</span> ';
            html += '<span class="http-status ' + statusClass + '">' + req.status + '</span> ';
            html += '<span class="http-duration">(' + req.durationMs + 'ms)</span>';
            html += '</div>';
        }
        if (data.data.http.length > 5) {
            html += '<div class="popover-more">... and ' + (data.data.http.length - 5) + ' more</div>';
        }
        html += '</div></div>';
    }

    // Terminal section
    if (data.data && data.data.terminal && data.data.terminal.length > 0) {
        hasContent = true;
        html += '<div class="popover-section">';
        html += '<div class="popover-section-header"><span class="popover-icon">\\ud83d\\udcbb</span> Terminal</div>';
        html += '<div class="popover-section-content terminal-content">';
        var termItems = data.data.terminal.slice(0, 5);
        for (var i = 0; i < termItems.length; i++) {
            var line = termItems[i].line;
            if (line.length > 60) line = line.substring(0, 57) + '...';
            html += '<div class="popover-item terminal-line">' + escapeHtmlBasic(line) + '</div>';
        }
        if (data.data.terminal.length > 5) {
            html += '<div class="popover-more">... and ' + (data.data.terminal.length - 5) + ' more lines</div>';
        }
        html += '</div></div>';
    }

    // Docker section
    if (data.data && data.data.docker && data.data.docker.length > 0) {
        hasContent = true;
        html += '<div class="popover-section">';
        html += '<div class="popover-section-header"><span class="popover-icon">\\ud83d\\udc33</span> Docker</div>';
        html += '<div class="popover-section-content">';
        for (var i = 0; i < data.data.docker.length; i++) {
            var container = data.data.docker[i];
            var healthClass = container.health === 'healthy' ? 'status-ok' : (container.health === 'unhealthy' ? 'status-error' : '');
            html += '<div class="popover-item">';
            html += '<span class="docker-name">' + escapeHtmlBasic(container.containerName) + '</span> ';
            html += '<span class="docker-status ' + healthClass + '">(' + escapeHtmlBasic(container.status) + (container.health ? ', ' + escapeHtmlBasic(container.health) : '') + ')</span>';
            html += '</div>';
        }
        html += '</div></div>';
    }

    // Events section
    if (data.data && data.data.events && data.data.events.length > 0) {
        hasContent = true;
        html += '<div class="popover-section">';
        html += '<div class="popover-section-header"><span class="popover-icon">\\ud83d\\udcdd</span> Events</div>';
        html += '<div class="popover-section-content">';
        var eventItems = data.data.events.slice(0, 5);
        for (var i = 0; i < eventItems.length; i++) {
            var evt = eventItems[i];
            html += '<div class="popover-item">[' + evt.source + '] ' + escapeHtmlBasic(evt.message) + '</div>';
        }
        html += '</div></div>';
    }

    var dbQueriesHtml = buildDatabaseQueriesPopoverSection(data);
    if (dbQueriesHtml) {
        hasContent = true;
        html += dbQueriesHtml;
    }

    var browserHtml = buildBrowserPopoverSection(data);
    if (browserHtml) {
        hasContent = true;
        html += browserHtml;
    }

    var securityHtml = buildSecurityPopoverSection(data);
    if (securityHtml) {
        hasContent = true;
        html += securityHtml;
    }

    var dbSignalHtml = buildDatabaseSignalPopoverSection(lineIdx);
    if (dbSignalHtml) {
        hasContent = true;
        html += dbSignalHtml;
    }

    var driftAdvisorAvail = (typeof window !== 'undefined' && window.driftAdvisorAvailable);
    // Drift Advisor section: session summary + CTA when extension is installed (meta from session end when driftAdvisor adapter enabled).
    var driftMeta = data.data && data.data.integrationsMeta && data.data.integrationsMeta['saropa-drift-advisor'];
    if (driftMeta && typeof driftMeta === 'object') {
        hasContent = true;
        html += '<div class="popover-section popover-section-drift">';
        html += '<div class="popover-section-header"><span class="popover-icon">\\ud83d\\udcbb</span> Drift Advisor</div>';
        html += '<div class="popover-section-content">';
        var perf = driftMeta.performance;
        if (perf && typeof perf === 'object') {
            var q = perf.totalQueries;
            var avg = perf.avgDurationMs;
            var slow = perf.slowCount;
            if (typeof q === 'number' || typeof avg === 'number' || typeof slow === 'number') {
                html += '<div class="popover-item">Queries: ' + (typeof q === 'number' ? q : '-') + ', avg ' + (typeof avg === 'number' ? avg.toFixed(0) : '-') + ' ms' + (typeof slow === 'number' && slow > 0 ? ', ' + slow + ' slow' : '') + '</div>';
            }
        }
        var health = driftMeta.health;
        if (health && typeof health === 'object' && 'ok' in health) {
            html += '<div class="popover-item">Health: ' + (health.ok ? 'OK' : 'Issues') + '</div>';
        }
        if (driftAdvisorAvail) {
            html += '<button class="popover-btn popover-drift-open" type="button">Open in Drift Advisor</button>';
        }
        html += '</div></div>';
    }

    if (!hasContent) {
        html += '<div class="popover-empty">No integration data in this time window</div>';
    }

    html += '</div>';
    html += '<div class="popover-footer">';
    html += '<button class="popover-btn popover-full">View Full Context</button>';
    html += '<button class="popover-btn popover-copy">Copy</button>';
    html += '</div>';

    return html;
}

` +
        getContextPopoverSharedScript() +
        `
` +
        getQualityPopoverScript() +
        `
// Register message handler
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'contextPopoverData') {
        handleContextPopoverData(msg);
    }
    if (msg.type === 'codeQualityPopoverData') {
        handleCodeQualityPopoverData(msg);
    }
});
`
    );
}

