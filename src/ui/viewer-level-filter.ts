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
/** Set of currently enabled log levels. All enabled by default. */
var enabledLevels = new Set(['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice']);

/** Number of preceding context lines to show when filtering. */
var contextLinesBefore = 3;

/** Error-level pattern for heuristic classification. */
var errorPattern = /\\b(error|exception|fail(ed|ure)?|fatal|panic|critical)\\b/i;

/** Warning-level pattern for heuristic classification. */
var warnPattern = /\\b(warn(ing)?|caution)\\b/i;

/** Performance-level pattern for heuristic classification. */
var perfPattern = /\\b(performance|dropped\\s+frame|fps|framerate|slow|lag|jank|stutter|skipped\\s+\\d+\\s+frames?|choreographer|doing\\s+too\\s+much\\s+work|gc\\s+pause|anr|application\\s+not\\s+responding)\\b/i;

/** TODO-level pattern for task markers and code comments. */
var todoPattern = /\\b(TODO|FIXME|HACK|XXX)\\b/i;

/** Debug/Breadcrumb-level pattern for trace logging. */
var debugPattern = /\\b(breadcrumb|trace|debug)\\b/i;

/** Notice-level pattern for important informational messages. */
var noticePattern = /\\b(notice|note|important)\\b/i;

/**
 * Classify a line's log level from its text content and category.
 * Called during addToData() to set item.level once on arrival.
 *
 * @param {string} plainText - HTML-stripped line text
 * @param {string} category - DAP output category
 * @returns {string} 'error', 'warning', 'performance', 'todo', 'debug', 'notice', or 'info'
 */
function classifyLevel(plainText, category) {
    if (category === 'stderr' || errorPattern.test(plainText)) {
        return 'error';
    }
    if (warnPattern.test(plainText)) {
        return 'warning';
    }
    if (perfPattern.test(plainText)) {
        return 'performance';
    }
    if (todoPattern.test(plainText)) {
        return 'todo';
    }
    if (debugPattern.test(plainText)) {
        return 'debug';
    }
    if (noticePattern.test(plainText)) {
        return 'notice';
    }
    return 'info';
}

/**
 * Apply level filter to all lines.
 * Shows lines whose level is enabled, plus N preceding context lines (dimmed).
 * Markers are never filtered out.
 */
function applyLevelFilter() {
    var allEnabled = enabledLevels.size === 7;

    // First pass: mark all lines as filtered or not
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        item.isContext = false;
        if (item.type === 'marker') {
            item.levelFiltered = false;
            continue;
        }
        if (allEnabled) {
            item.levelFiltered = false;
            continue;
        }
        item.levelFiltered = !enabledLevels.has(item.level);
    }

    // Second pass: mark context lines preceding each visible match
    if (!allEnabled && contextLinesBefore > 0) {
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
 * Toggle a log level on/off.
 *
 * @param {string} level - 'info', 'warning', or 'error'
 */
function toggleLevel(level) {
    if (enabledLevels.has(level)) {
        enabledLevels.delete(level);
    } else {
        enabledLevels.add(level);
    }

    // Update button active state
    var btn = document.getElementById('level-' + level + '-toggle');
    if (btn) {
        btn.classList.toggle('active', enabledLevels.has(level));
    }

    applyLevelFilter();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/**
 * Handle setContextLines message from extension.
 */
function handleSetContextLines(msg) {
    contextLinesBefore = typeof msg.count === 'number' ? msg.count : 3;
    if (enabledLevels.size < 7) {
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

// Register click handlers for level filter circles
var levelInfoBtn = document.getElementById('level-info-toggle');
var levelWarnBtn = document.getElementById('level-warn-toggle');
var levelErrorBtn = document.getElementById('level-error-toggle');
var levelPerfBtn = document.getElementById('level-perf-toggle');
var levelTodoBtn = document.getElementById('level-todo-toggle');
var levelDebugBtn = document.getElementById('level-debug-toggle');
var levelNoticeBtn = document.getElementById('level-notice-toggle');
if (levelInfoBtn) levelInfoBtn.addEventListener('click', function() { toggleLevel('info'); });
if (levelWarnBtn) levelWarnBtn.addEventListener('click', function() { toggleLevel('warning'); });
if (levelErrorBtn) levelErrorBtn.addEventListener('click', function() { toggleLevel('error'); });
if (levelPerfBtn) levelPerfBtn.addEventListener('click', function() { toggleLevel('performance'); });
if (levelTodoBtn) levelTodoBtn.addEventListener('click', function() { toggleLevel('todo'); });
if (levelDebugBtn) levelDebugBtn.addEventListener('click', function() { toggleLevel('debug'); });
if (levelNoticeBtn) levelNoticeBtn.addEventListener('click', function() { toggleLevel('notice'); });
`;
}
