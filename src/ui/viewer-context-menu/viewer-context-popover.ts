/**
 * Context Popover Script
 *
 * Displays a floating popover with integration context data (performance,
 * HTTP requests, terminal output, etc.) filtered to ±N seconds around
 * a clicked log line. Triggered from the context menu "Show Integration Context".
 */

/**
 * Returns the JavaScript code for the context popover in the webview.
 */
export function getContextPopoverScript(): string {
    return /* javascript */ `
var contextPopoverEl = null;
var contextPopoverLineIdx = -1;

function showContextPopover(lineIdx, anchorX, anchorY, data) {
    closeContextPopover();
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

function escapeHtmlBasic(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function copyPopoverContent() {
    var content = contextPopoverEl ? contextPopoverEl.innerText : '';
    vscodeApi.postMessage({ type: 'copyToClipboard', text: content });
}

function showPopoverToast(message) {
    var existing = document.getElementById('popover-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'popover-toast';
    toast.className = 'copy-toast visible';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { toast.remove(); }, 200);
    }, 2500);
}

function handleContextPopoverData(msg) {
    if (msg.error) {
        showPopoverToast(msg.error);
        return;
    }
    var lineIdx = msg.lineIndex || 0;
    var lineEl = document.querySelector('[data-idx="' + lineIdx + '"]');
    var anchorX = 100;
    var anchorY = 100;
    if (lineEl) {
        var rect = lineEl.getBoundingClientRect();
        anchorX = rect.left + 20;
        anchorY = rect.bottom;
    }
    showContextPopover(lineIdx, anchorX, anchorY, msg);
}

// Register message handler
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'contextPopoverData') {
        handleContextPopoverData(msg);
    }
});
`;
}

/**
 * Returns the CSS styles for the context popover.
 */
export function getContextPopoverStyles(): string {
    return /* css */ `
/* ===================================================================
   Context Popover
   Floating popover showing integration context for a log line.
   Positioned near the clicked line, dismissible via click outside or Esc.
   =================================================================== */
@keyframes popover-reveal {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.context-popover {
    position: fixed;
    z-index: 1000;
    min-width: 320px;
    max-width: 500px;
    max-height: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-focusBorder));
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    animation: popover-reveal 0.15s ease-out;
}

.popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--vscode-editorHoverWidget-statusBarBackground, rgba(0, 0, 0, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.popover-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.popover-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1;
}
.popover-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

.popover-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.popover-section {
    padding: 0 12px;
    margin-bottom: 8px;
}
.popover-section:last-child {
    margin-bottom: 0;
}

.popover-section-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.popover-icon {
    font-size: 13px;
}

.popover-section-content {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    padding-left: 20px;
}

.popover-item {
    padding: 2px 0;
    line-height: 1.4;
}

.popover-more {
    font-style: italic;
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
    padding-top: 2px;
}

.popover-empty {
    padding: 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}

/* HTTP styles */
.http-item {
    font-family: var(--vscode-editor-font-family, monospace);
}
.http-method {
    font-weight: 600;
    color: var(--vscode-symbolIcon-methodForeground, #b180d7);
}
.http-url {
    color: var(--vscode-textLink-foreground);
}
.http-status.status-ok {
    color: var(--vscode-testing-iconPassed, #73c991);
}
.http-status.status-error {
    color: var(--vscode-errorForeground, #f44);
}
.http-status.status-redirect {
    color: var(--vscode-editorWarning-foreground, #cca700);
}
.http-duration {
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
}

/* Terminal styles */
.terminal-content {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
}
.terminal-line {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Docker styles */
.docker-name {
    font-weight: 500;
}
.docker-status.status-ok {
    color: var(--vscode-testing-iconPassed, #73c991);
}
.docker-status.status-error {
    color: var(--vscode-errorForeground, #f44);
}

.popover-footer {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.popover-btn {
    padding: 4px 10px;
    font-size: 11px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 4px;
    cursor: pointer;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.popover-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.popover-btn.popover-full {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.popover-btn.popover-full:hover {
    background: var(--vscode-button-hoverBackground);
}
`;
}
