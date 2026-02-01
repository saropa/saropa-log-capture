/**
 * Scrollbar Minimap Script
 *
 * Provides a visual minimap overlay on the scrollbar showing:
 * - Search match locations (yellow marks)
 * - Current match location (orange mark)
 * - Error locations (red marks)
 * - Warning locations (orange marks)
 *
 * Updates whenever search results change or content scrolls.
 */

/**
 * Returns the JavaScript code for scrollbar minimap in the webview.
 */
export function getScrollbarMinimapScript(): string {
    return /* javascript */ `
/** Whether the minimap is enabled. */
var minimapEnabled = true;

/** The minimap container element. */
var minimapEl = null;

/**
 * Initialize the scrollbar minimap.
 */
function initMinimap() {
    minimapEl = document.getElementById('scrollbar-minimap');
    if (!minimapEl) return;

    // Update minimap on scroll
    var logContent = document.getElementById('log-content');
    if (logContent) {
        logContent.addEventListener('scroll', updateMinimapViewport);
    }

    updateMinimap();
}

/**
 * Update all minimap markers based on current search results and log levels.
 */
function updateMinimap() {
    if (!minimapEl || !minimapEnabled) {
        if (minimapEl) minimapEl.innerHTML = '';
        return;
    }

    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    var totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        totalHeight += allLines[i].height;
    }

    if (totalHeight === 0) return;

    var markers = [];

    // Add search match markers
    if (matchIndices && matchIndices.length > 0) {
        for (var i = 0; i < matchIndices.length; i++) {
            var idx = matchIndices[i];
            var isCurrent = currentMatchIdx === i;
            var cumHeight = 0;
            for (var j = 0; j < idx; j++) {
                cumHeight += allLines[j].height;
            }
            var percent = (cumHeight / totalHeight) * 100;
            markers.push({
                percent: percent,
                type: isCurrent ? 'current-match' : 'search-match'
            });
        }
    }

    // Add error/warning markers (optional - can be toggled)
    for (var i = 0; i < allLines.length; i++) {
        var line = allLines[i];
        if (line.level === 'error' || line.level === 'warning') {
            var cumHeight = 0;
            for (var j = 0; j < i; j++) {
                cumHeight += allLines[j].height;
            }
            var percent = (cumHeight / totalHeight) * 100;
            markers.push({
                percent: percent,
                type: line.level
            });
        }
    }

    // Render markers
    var html = '';
    for (var i = 0; i < markers.length; i++) {
        var m = markers[i];
        html += '<div class="minimap-marker minimap-' + m.type + '" style="top: ' + m.percent + '%;"></div>';
    }

    // Add viewport indicator
    var scrollPercent = (logContent.scrollTop / totalHeight) * 100;
    var viewportHeight = (logContent.clientHeight / totalHeight) * 100;
    html += '<div class="minimap-viewport" style="top: ' + scrollPercent + '%; height: ' + viewportHeight + '%;"></div>';

    minimapEl.innerHTML = html;
}

/**
 * Update just the viewport indicator position (called on scroll for performance).
 */
function updateMinimapViewport() {
    if (!minimapEl || !minimapEnabled) return;

    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    var totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        totalHeight += allLines[i].height;
    }

    if (totalHeight === 0) return;

    var viewportEl = minimapEl.querySelector('.minimap-viewport');
    if (viewportEl) {
        var scrollPercent = (logContent.scrollTop / totalHeight) * 100;
        var viewportHeight = (logContent.clientHeight / totalHeight) * 100;
        viewportEl.style.top = scrollPercent + '%';
        viewportEl.style.height = viewportHeight + '%';
    }
}

/**
 * Toggle minimap on/off.
 */
function toggleMinimap() {
    minimapEnabled = !minimapEnabled;
    var btn = document.getElementById('minimap-toggle');
    if (btn) {
        btn.textContent = 'Minimap: ' + (minimapEnabled ? 'ON' : 'OFF');
    }
    if (minimapEnabled) {
        updateMinimap();
    } else {
        if (minimapEl) minimapEl.innerHTML = '';
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinimap);
} else {
    initMinimap();
}

// Register toggle button handler
var minimapToggleBtn = document.getElementById('minimap-toggle');
if (minimapToggleBtn) {
    minimapToggleBtn.addEventListener('click', toggleMinimap);
}

// Hook into search updates to refresh minimap
var _originalUpdateSearch = updateSearch;
if (typeof updateSearch === 'function') {
    updateSearch = function() {
        _originalUpdateSearch();
        setTimeout(updateMinimap, 50);
    };
}

// Hook into viewport renders to refresh minimap
var _originalRenderViewport = renderViewport;
if (typeof renderViewport === 'function') {
    renderViewport = function(force) {
        _originalRenderViewport(force);
        setTimeout(updateMinimap, 50);
    };
}
`;
}

/**
 * Returns the HTML for the scrollbar minimap element.
 */
export function getScrollbarMinimapHtml(): string {
    return `<div id="scrollbar-minimap" class="scrollbar-minimap"></div>`;
}
