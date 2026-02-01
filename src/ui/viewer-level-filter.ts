/**
 * Viewer Level Filter Script
 *
 * Provides quick-filter buttons for error/warning log levels in the footer.
 * When a level filter is active, non-matching lines are hidden but preceding
 * context lines are shown dimmed for readability.
 *
 * Integration points:
 * - addToData() classifies each line's level (error/warning/info)
 * - Footer buttons trigger setLevelFilter()
 * - renderItem() applies context-line dimming via CSS class
 * - Extension sends contextLinesBefore count via setContextLines message
 */

/**
 * Returns the JavaScript code for level filtering in the webview.
 */
export function getLevelFilterScript(): string {
    return /* javascript */ `
/** Current active level filter: 'all', 'error', or 'warn'. */
var activeLevelFilter = 'all';

/** Number of preceding context lines to show when filtering. */
var contextLinesBefore = 3;

/** Error-level pattern for heuristic classification. */
var errorPattern = /\\b(error|exception|fail(ed|ure)?|fatal|panic|critical)\\b/i;

/** Warning-level pattern for heuristic classification. */
var warnPattern = /\\b(warn(ing)?|caution)\\b/i;

/**
 * Classify a line's log level from its text content and category.
 * Called during addToData() to set item.level once on arrival.
 *
 * @param {string} plainText - HTML-stripped line text
 * @param {string} category - DAP output category
 * @returns {string} 'error', 'warning', or 'info'
 */
function classifyLevel(plainText, category) {
    if (category === 'stderr' || errorPattern.test(plainText)) {
        return 'error';
    }
    if (warnPattern.test(plainText)) {
        return 'warning';
    }
    return 'info';
}

/**
 * Apply level filter to all lines.
 * Shows matching lines plus N preceding context lines (dimmed).
 * Markers are never filtered out.
 */
function applyLevelFilter() {
    // First pass: mark all lines as filtered or not
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        item.isContext = false;
        if (item.type === 'marker') {
            continue;
        }
        if (activeLevelFilter === 'all') {
            item.levelFiltered = false;
            continue;
        }
        if (activeLevelFilter === 'error') {
            item.levelFiltered = item.level !== 'error';
        } else if (activeLevelFilter === 'warn') {
            item.levelFiltered = item.level !== 'error' && item.level !== 'warning';
        }
    }

    // Second pass: mark context lines preceding each visible match
    if (activeLevelFilter !== 'all' && contextLinesBefore > 0) {
        for (var i = 0; i < allLines.length; i++) {
            if (allLines[i].levelFiltered || allLines[i].type === 'marker') {
                continue;
            }
            // Walk backwards to mark context lines
            for (var j = 1; j <= contextLinesBefore && (i - j) >= 0; j++) {
                var ctx = allLines[i - j];
                if (ctx.type === 'marker') { continue; }
                if (ctx.levelFiltered) {
                    ctx.levelFiltered = false;
                    ctx.isContext = true;
                }
            }
        }
    }

    recalcHeights();
    renderViewport(true);
}

/**
 * Set the active level filter and update button states.
 *
 * @param {string} level - 'all', 'error', or 'warn'
 */
function setLevelFilter(level) {
    activeLevelFilter = level;

    // Update button active states
    var btns = document.querySelectorAll('.level-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    var activeBtn = document.getElementById('level-' + level);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    applyLevelFilter();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/**
 * Handle setContextLines message from extension.
 */
function handleSetContextLines(msg) {
    contextLinesBefore = typeof msg.count === 'number' ? msg.count : 3;
    if (activeLevelFilter !== 'all') {
        applyLevelFilter();
    }
}

// Register message handler for context lines setting
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'setContextLines') {
        handleSetContextLines(msg);
    }
});

// Register click handlers for level filter buttons
var levelAllBtn = document.getElementById('level-all');
var levelErrorBtn = document.getElementById('level-error');
var levelWarnBtn = document.getElementById('level-warn');
if (levelAllBtn) levelAllBtn.addEventListener('click', function() { setLevelFilter('all'); });
if (levelErrorBtn) levelErrorBtn.addEventListener('click', function() { setLevelFilter('error'); });
if (levelWarnBtn) levelWarnBtn.addEventListener('click', function() { setLevelFilter('warn'); });
`;
}
