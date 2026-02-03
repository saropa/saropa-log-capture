/**
 * Live Statistics Script
 *
 * Provides real-time running counters for log levels, displayed
 * directly on the level filter circle buttons in the footer.
 * Each circle shows its emoji plus a count when > 0 (e.g. "🔴 4").
 *
 * Updates incrementally as new lines arrive via addLines message.
 */

/** Returns the JavaScript code for statistics counters. */
export function getStatsScript(): string {
    return /* javascript */ `
/** Running totals for each log level. */
var statsCounters = {
    error: 0,
    warning: 0,
    performance: 0,
    info: 0,
    todo: 0,
    debug: 0,
    notice: 0
};

/** Emoji lookup for each level (used when updating button content). */
var levelEmojis = {
    info: '\\uD83D\\uDFE2',
    warning: '\\uD83D\\uDFE0',
    error: '\\uD83D\\uDD34',
    performance: '\\uD83D\\uDFE3',
    todo: '\\u26AA',
    debug: '\\uD83D\\uDFE4',
    notice: '\\uD83D\\uDFE6'
};

/** Button ID lookup for each level. */
var levelButtonIds = {
    info: 'level-info-toggle',
    warning: 'level-warning-toggle',
    error: 'level-error-toggle',
    performance: 'level-performance-toggle',
    todo: 'level-todo-toggle',
    debug: 'level-debug-toggle',
    notice: 'level-notice-toggle'
};

/**
 * Update the count span inside a level circle button.
 */
function updateLevelCircle(level) {
    var btn = document.getElementById(levelButtonIds[level]);
    if (!btn) return;
    var countEl = btn.querySelector('.level-count');
    if (!countEl) return;
    var count = statsCounters[level] || 0;
    countEl.textContent = count > 0 ? String(count) : '';
}

/**
 * Update all level circle buttons with current counts.
 */
function updateStatsDisplay() {
    var levels = Object.keys(statsCounters);
    for (var i = 0; i < levels.length; i++) {
        updateLevelCircle(levels[i]);
    }
}

/**
 * Increment counters based on incoming lines.
 * Uses classifyLevel() from the level-filter script.
 */
function updateStatsFromLines(lines) {
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var plainText = stripTags(line.html || line.text || '');
        var category = line.category || '';
        var level = classifyLevel(plainText, category);
        statsCounters[level]++;
    }
    updateStatsDisplay();
}

/**
 * Reset all statistics counters and update display.
 */
function resetStats() {
    var levels = Object.keys(statsCounters);
    for (var i = 0; i < levels.length; i++) {
        statsCounters[levels[i]] = 0;
    }
    updateStatsDisplay();
}

// Hook into addLines message to update stats
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'addLines' && msg.lines) {
        updateStatsFromLines(msg.lines);
    } else if (msg.type === 'reset' || msg.type === 'clear') {
        resetStats();
    }
});
`;
}

/** Stats HTML is no longer needed — counts display on level circles. */
export function getStatsHtml(): string {
    return '';
}
