/**
 * Live Statistics Script
 *
 * Provides real-time running counters for log levels:
 * - Errors (red)
 * - Warnings (orange)
 * - Performance issues (purple)
 * - Framework/Info logs (green)
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
    info: 0
};

/**
 * Update the statistics display in the footer.
 */
function updateStatsDisplay() {
    var statsEl = document.getElementById('stats-counters');
    if (!statsEl) return;

    var parts = [];
    if (statsCounters.error > 0) {
        parts.push('<span class="stat-error" title="Errors">🔴 ' + statsCounters.error + '</span>');
    }
    if (statsCounters.warning > 0) {
        parts.push('<span class="stat-warning" title="Warnings">🟠 ' + statsCounters.warning + '</span>');
    }
    if (statsCounters.performance > 0) {
        parts.push('<span class="stat-performance" title="Performance Issues">🟣 ' + statsCounters.performance + '</span>');
    }
    if (statsCounters.info > 0) {
        parts.push('<span class="stat-info" title="Framework/Info">🟢 ' + statsCounters.info + '</span>');
    }

    statsEl.innerHTML = parts.length > 0 ? parts.join(' ') : '';
}

/**
 * Increment counters based on incoming lines.
 * Hooked into the addLines message handler.
 */
function updateStatsFromLines(lines) {
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // Classify using the same logic as classifyLevel
        var plainText = stripTags(line.html || line.text || '');
        var category = line.category || '';
        var level = 'info';

        if (category === 'stderr' || /\\b(error|exception|fail(ed|ure)?|fatal|panic|critical)\\b/i.test(plainText)) {
            level = 'error';
        } else if (/\\b(warn(ing)?|caution)\\b/i.test(plainText)) {
            level = 'warning';
        } else if (/\\b(performance|dropped\\s+frame|fps|framerate|slow|lag|jank|stutter|skipped\\s+\\d+\\s+frames?|choreographer|doing\\s+too\\s+much\\s+work|gc\\s+pause|anr|application\\s+not\\s+responding)\\b/i.test(plainText)) {
            level = 'performance';
        }

        statsCounters[level]++;
    }
    updateStatsDisplay();
}

/**
 * Reset all statistics counters.
 */
function resetStats() {
    statsCounters.error = 0;
    statsCounters.warning = 0;
    statsCounters.performance = 0;
    statsCounters.info = 0;
    updateStatsDisplay();
}

// Hook into addLines message to update stats
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'addLines' && msg.lines) {
        updateStatsFromLines(msg.lines);
    } else if (msg.type === 'reset') {
        resetStats();
    }
});
`;
}

/** Returns the HTML for statistics counters in the footer. */
export function getStatsHtml(): string {
    return `<span id="stats-counters" title="Live statistics"></span>`;
}
