/**
 * Client-side JavaScript for log line decoration prefixes in the viewer.
 *
 * Prefixes each line with a configurable combination of:
 *   - Colored severity dot (🟢 info, 🟠 warning, 🔴 error)
 *   - Sequential counter (#1, #2, ...)
 *   - Wall-clock timestamp (T07:23:36)
 *   - Separator (»)
 *
 * Also provides whole-line severity tinting (subtle background colors).
 *
 * All rendering is viewer-only — log files on disk are never modified.
 * Sub-toggles (decoShowDot, decoShowCounter, decoShowTimestamp) and
 * decoLineColorMode are declared in viewer-deco-settings.ts and shared
 * via the concatenated script scope.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getDecorationsScript(): string {
    return /* javascript */ `
/** Master switch — when false, all decoration rendering is skipped. */
var showDecorations = false;

/**
 * Map log level to a colored dot emoji.
 * 🔴 = error, 🟠 = warning, 🟢 = info (default).
 */
function getLevelDot(level) {
    if (level === 'error') return '\\ud83d\\udd34';
    if (level === 'warning') return '\\ud83d\\udfe0';
    return '\\ud83d\\udfe2';
}

/**
 * Format epoch ms to wall-clock time string (T07:23:36).
 * Returns empty string if timestamp is falsy (e.g. markers).
 */
function formatDecoTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = ('0' + d.getHours()).slice(-2);
    var m = ('0' + d.getMinutes()).slice(-2);
    var s = ('0' + d.getSeconds()).slice(-2);
    return 'T' + h + ':' + m + ':' + s;
}

/**
 * Reset all sub-toggles to their defaults.
 * Called when the master toggle turns ON so the user starts
 * with a clean, fully-enabled decoration state.
 */
function resetDecoDefaults() {
    decoShowDot = true;
    decoShowCounter = true;
    decoShowTimestamp = true;
    decoLineColorMode = 'none';
}

/** Update the Deco button label to reflect the master toggle state. */
function updateDecoButton() {
    var btn = document.getElementById('deco-toggle');
    if (btn) btn.textContent = showDecorations ? 'Deco: ON' : 'Deco: OFF';
}

/**
 * Build the decoration prefix HTML for a single log line.
 * Only includes parts whose sub-toggle is enabled.
 * Returns empty string for markers, stack-frame sub-lines, or when off.
 *
 * Example output: <span class="line-decoration">🟢 #1 T07:23:36 » </span>
 */
function getDecorationPrefix(item) {
    if (!showDecorations) return '';
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return '';
    var parts = [];
    if (decoShowDot) parts.push(getLevelDot(item.level || 'info'));
    if (decoShowCounter) parts.push('#' + (item.seq !== undefined ? item.seq : '?'));
    if (decoShowTimestamp) {
        var ts = formatDecoTimestamp(item.timestamp);
        if (ts) parts.push(ts);
    }
    if (parts.length === 0) return '';
    return '<span class="line-decoration">'
        + parts.join('&nbsp; ') + '&nbsp; \\u00BB '
        + '</span>';
}

/**
 * Return a CSS class for whole-line severity tinting.
 * Only active when decoLineColorMode is 'line' and decorations are on.
 * Info-level lines get no tint to avoid visual noise.
 */
function getLineTintClass(item) {
    if (decoLineColorMode !== 'line' || !showDecorations) return '';
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return '';
    if (item.level === 'error') return ' line-tint-error';
    if (item.level === 'warning') return ' line-tint-warning';
    return '';
}

/** Handle setShowDecorations message from the extension (sent at session start). */
function handleSetShowDecorations(msg) {
    showDecorations = !!msg.show;
    if (showDecorations) {
        resetDecoDefaults();
    } else {
        if (typeof closeDecoSettings === 'function') closeDecoSettings();
    }
    if (typeof syncDecoSettingsUi === 'function') syncDecoSettingsUi();
    updateDecoButton();
    renderViewport(true);
}

/** Toggle the master decoration switch via the footer Deco button. */
function toggleDecorations() {
    showDecorations = !showDecorations;
    if (showDecorations) {
        resetDecoDefaults();
    } else {
        if (typeof closeDecoSettings === 'function') closeDecoSettings();
    }
    if (typeof syncDecoSettingsUi === 'function') syncDecoSettingsUi();
    updateDecoButton();
    renderViewport(true);
}
`;
}
