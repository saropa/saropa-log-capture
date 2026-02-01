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

/** Cached total height from last full updateMinimap call. */
var minimapCachedHeight = 0;

/** Pending debounce timer for full minimap rebuilds. */
var minimapDebounceTimer = 0;

/** Initialize the scrollbar minimap. */
function initMinimap() {
    minimapEl = document.getElementById('scrollbar-minimap');
    if (!minimapEl) return;

    // RAF-debounced scroll listener — only moves the viewport indicator
    var logContent = document.getElementById('log-content');
    if (logContent) {
        var mmRaf = false;
        logContent.addEventListener('scroll', function() {
            if (!mmRaf) {
                mmRaf = true;
                requestAnimationFrame(function() { mmRaf = false; updateMinimapViewport(); });
            }
        });
    }
    updateMinimap();
}

/**
 * Rebuild all minimap markers from scratch.
 * Uses a single O(n) pass to compute cumulative heights.
 */
function updateMinimap() {
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = 0;
    if (!minimapEl || !minimapEnabled) {
        if (minimapEl) minimapEl.innerHTML = '';
        minimapCachedHeight = 0;
        return;
    }

    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    // Single-pass cumulative height: O(n)
    var cumH = new Array(allLines.length);
    var running = 0;
    for (var i = 0; i < allLines.length; i++) {
        cumH[i] = running;
        running += allLines[i].height;
    }
    minimapCachedHeight = running;

    if (running === 0) { minimapEl.innerHTML = ''; return; }

    var markers = [];

    // Search match markers — O(matchCount) using pre-computed cumH
    if (typeof matchIndices !== 'undefined' && matchIndices && matchIndices.length > 0) {
        for (var i = 0; i < matchIndices.length; i++) {
            var idx = matchIndices[i];
            if (idx < cumH.length) {
                var isCur = (typeof currentMatchIdx !== 'undefined') && currentMatchIdx === i;
                markers.push({ p: (cumH[idx] / running) * 100, t: isCur ? 'current-match' : 'search-match' });
            }
        }
    }

    // Error / warning markers — single pass, O(n)
    for (var i = 0; i < allLines.length; i++) {
        var lvl = allLines[i].level;
        if (lvl === 'error' || lvl === 'warning') {
            markers.push({ p: (cumH[i] / running) * 100, t: lvl });
        }
    }

    // Build HTML
    var html = '';
    for (var i = 0; i < markers.length; i++) {
        html += '<div class="minimap-marker minimap-' + markers[i].t + '" style="top:' + markers[i].p + '%"></div>';
    }

    // Viewport indicator
    var sp = (logContent.scrollTop / running) * 100;
    var vh = (logContent.clientHeight / running) * 100;
    html += '<div class="minimap-viewport" style="top:' + sp + '%;height:' + vh + '%"></div>';

    minimapEl.innerHTML = html;
}

/**
 * Schedule a debounced minimap rebuild.
 * Batches rapid data changes into one DOM update.
 */
function scheduleMinimap() {
    if (!minimapEnabled) return;
    if (minimapDebounceTimer) return;
    minimapDebounceTimer = setTimeout(updateMinimap, 120);
}

/**
 * Move the viewport indicator — O(1) using cached height.
 * Called on scroll; never rebuilds markers.
 */
function updateMinimapViewport() {
    if (!minimapEl || !minimapEnabled || minimapCachedHeight === 0) return;

    var indicator = minimapEl.querySelector('.minimap-viewport');
    if (!indicator) return;

    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    var sp = (logContent.scrollTop / minimapCachedHeight) * 100;
    var vh = (logContent.clientHeight / minimapCachedHeight) * 100;
    indicator.style.top = sp + '%';
    indicator.style.height = vh + '%';
}

/** Toggle minimap on/off. */
function toggleMinimap() {
    minimapEnabled = !minimapEnabled;
    var btn = document.getElementById('minimap-toggle');
    if (btn) {
        btn.title = minimapEnabled ? 'Minimap ON (click to hide)' : 'Minimap OFF (click to show)';
        if (minimapEnabled) {
            btn.classList.remove('toggle-inactive');
        } else {
            btn.classList.add('toggle-inactive');
        }
    }
    if (minimapEnabled) {
        updateMinimap();
    } else if (minimapEl) {
        minimapEl.innerHTML = '';
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

// Hook into search updates — schedule a debounced rebuild
var _originalUpdateSearch = updateSearch;
if (typeof updateSearch === 'function') {
    updateSearch = function() {
        _originalUpdateSearch();
        scheduleMinimap();
    };
}

// Hook into viewport renders — only rebuild when data changed (force=true)
var _originalRenderViewport = renderViewport;
if (typeof renderViewport === 'function') {
    renderViewport = function(force) {
        _originalRenderViewport(force);
        if (force) { scheduleMinimap(); }
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
