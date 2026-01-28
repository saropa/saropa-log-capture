/**
 * Client-side JavaScript for source preview hover tooltips.
 * Shows 3-5 lines of source code when hovering over source links in stack frames.
 */
export function getSourcePreviewScript(): string {
    return /* javascript */ `
var previewEl = document.getElementById('source-preview');
var previewTimer = null;
var previewHideTimer = null;
var currentPreviewPath = '';
var currentPreviewLine = 0;

function showPreviewLoading(link) {
    var path = link.dataset.path || '';
    var line = parseInt(link.dataset.line || '1');
    if (!path) return;

    currentPreviewPath = path;
    currentPreviewLine = line;

    var rect = link.getBoundingClientRect();
    previewEl.innerHTML = '<div class="preview-loading">Loading...</div>';
    previewEl.classList.add('visible');
    positionPreview(rect);

    vscodeApi.postMessage({
        type: 'requestSourcePreview',
        path: path,
        line: line,
    });
}

function positionPreview(linkRect) {
    var previewRect = previewEl.getBoundingClientRect();
    var viewportHeight = window.innerHeight;
    var viewportWidth = window.innerWidth;

    // Position below the link by default
    var top = linkRect.bottom + 4;
    var left = linkRect.left;

    // If not enough space below, show above
    if (top + previewRect.height > viewportHeight - 20) {
        top = linkRect.top - previewRect.height - 4;
    }

    // Keep within viewport horizontally
    if (left + previewRect.width > viewportWidth - 10) {
        left = Math.max(10, viewportWidth - previewRect.width - 10);
    }

    // Ensure not negative
    if (top < 10) top = 10;
    if (left < 10) left = 10;

    previewEl.style.top = top + 'px';
    previewEl.style.left = left + 'px';
}

function hidePreview() {
    previewEl.classList.remove('visible');
    currentPreviewPath = '';
    currentPreviewLine = 0;
}

function handleSourcePreviewResponse(msg) {
    if (msg.path !== currentPreviewPath || msg.line !== currentPreviewLine) {
        return; // Stale response
    }

    if (msg.error || !msg.lines || msg.lines.length === 0) {
        previewEl.innerHTML = '<div class="preview-loading">Unable to load preview</div>';
        return;
    }

    var filename = msg.path.split(/[\\\\/]/).pop() || msg.path;
    var html = '<div class="preview-header">' + escapeHtmlPreview(filename) + ':' + msg.line + '</div>';
    html += '<div class="preview-code">';

    for (var i = 0; i < msg.lines.length; i++) {
        var lineNum = msg.startLine + i;
        var isTarget = lineNum === msg.line;
        var cls = isTarget ? ' target' : '';
        html += '<div class="preview-line' + cls + '">';
        html += '<span class="line-num">' + lineNum + '</span>';
        html += escapeHtmlPreview(msg.lines[i]);
        html += '</div>';
    }

    html += '</div>';
    previewEl.innerHTML = html;

    // Reposition after content loaded (size may have changed)
    var link = document.querySelector('.source-link[data-path="' + CSS.escape(msg.path) + '"][data-line="' + msg.line + '"]');
    if (link) {
        positionPreview(link.getBoundingClientRect());
    }
}

function escapeHtmlPreview(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Add hover listeners to viewport for source links
viewportEl.addEventListener('mouseenter', function(e) {
    var link = e.target.closest && e.target.closest('.source-link');
    if (!link) return;

    clearTimeout(previewTimer);
    clearTimeout(previewHideTimer);

    previewTimer = setTimeout(function() {
        showPreviewLoading(link);
    }, 400); // Delay before showing preview
}, true);

viewportEl.addEventListener('mouseleave', function(e) {
    var link = e.target.closest && e.target.closest('.source-link');
    if (!link) return;

    clearTimeout(previewTimer);
    previewHideTimer = setTimeout(hidePreview, 200);
}, true);

// Keep preview visible when hovering over it
previewEl.addEventListener('mouseenter', function() {
    clearTimeout(previewHideTimer);
});

previewEl.addEventListener('mouseleave', function() {
    previewHideTimer = setTimeout(hidePreview, 200);
});

`;
}
