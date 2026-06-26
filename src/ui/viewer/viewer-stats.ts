/**
 * Live Statistics Script
 *
 * Provides real-time running counters for log levels, displayed
 * on both the footer dot groups and the fly-up circle buttons.
 * Footer dots show compact counts; fly-up circles show full counts.
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
    notice: 0,
    database: 0
};

/** Emoji lookup for each level (used when updating button content). */
var levelEmojis = {
    info: '\\uD83D\\uDFE2',
    warning: '\\uD83D\\uDFE0',
    error: '\\uD83D\\uDD34',
    performance: '\\uD83D\\uDFE3',
    todo: '\\u26AA',
    debug: '\\uD83D\\uDFE4',
    notice: '\\uD83D\\uDFE6',
    database: '\\uD83D\\uDFE1'
};

/** Button ID lookup for each level. */
var levelButtonIds = {
    info: 'level-info-toggle',
    warning: 'level-warning-toggle',
    error: 'level-error-toggle',
    performance: 'level-performance-toggle',
    todo: 'level-todo-toggle',
    debug: 'level-debug-toggle',
    notice: 'level-notice-toggle',
    database: 'level-database-toggle'
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
    countEl.textContent = count > 0 ? formatNumber(count) : '';
}

/**
 * Update the compact dot counts in the footer.
 */
function updateDotCounts() {
    var groups = document.querySelectorAll('.level-dot-group');
    for (var i = 0; i < groups.length; i++) {
        var lvl = groups[i].getAttribute('data-level');
        var countEl = groups[i].querySelector('.dot-count');
        if (!countEl || !lvl) continue;
        var c = statsCounters[lvl] || 0;
        countEl.textContent = c > 0 ? formatNumber(c) : '';
        groups[i].style.display = c > 0 ? '' : 'none';
    }
}

/**
 * Update all level circle buttons and footer dots with current counts.
 */
function updateStatsDisplay() {
    var levels = Object.keys(statsCounters);
    for (var i = 0; i < levels.length; i++) {
        updateLevelCircle(levels[i]);
    }
    updateDotCounts();
}

/**
 * Recompute every level counter from the rendered line items (allLines).
 *
 * The badge MUST equal what soloing that level shows. The earlier approach counted
 * raw incoming text with classifyLevel() — a SECOND, independent classification that
 * diverged from the per-row item.level the filter actually uses:
 *   - addToData() demotes device-other (Android-native logcat: gralloc4, Badge,
 *     MediaCodec…) error/warning to 'info' for display (plan 050). Raw counting still
 *     saw "E/" and tallied them as errors, so the Error badge read 32 while soloing
 *     Error showed zero — those 32 rows carry item.level 'info'.
 *   - Repeat-collapse, banner override, and ascii-art demotion likewise change the
 *     effective level. Any of them desynced count from filter.
 * Counting the actual item.level over allLines makes badge == focus by construction:
 * the same field the filter reads (item.level) is the field tallied here. Collapsed
 * SQL contributes one item (the repeat-notification row) — i.e. "what WILL be shown".
 * Markers carry no level and are skipped, exactly as applyLevelFilter() skips them.
 */
function recomputeStatsCounters() {
    var keys = Object.keys(statsCounters);
    for (var k = 0; k < keys.length; k++) { statsCounters[keys[k]] = 0; }
    if (typeof allLines !== 'undefined' && allLines) {
        for (var i = 0; i < allLines.length; i++) {
            var it = allLines[i];
            if (!it || it.type === 'marker') continue;
            var lvl = it.level;
            if (lvl && Object.prototype.hasOwnProperty.call(statsCounters, lvl)) {
                statsCounters[lvl]++;
            }
        }
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

// Reset on clear/reset. addLines counts are recomputed by recomputeStatsCounters(),
// called from the addLines handler AFTER addToData() + trimData() have settled allLines
// and collapse — driving it from there (not a second message listener here) guarantees
// the recompute reads the post-batch array rather than racing the addToData loop.
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'reset' || msg.type === 'clear') {
        resetStats();
    }
});
`;
}

/** Stats HTML is no longer needed — counts display on level circles. */
export function getStatsHtml(): string {
    return '';
}
