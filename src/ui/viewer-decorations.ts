/**
 * Client-side JavaScript for log line decoration prefixes in the viewer.
 *
 * Prefixes each line with a configurable combination of:
 *   - Colored severity dot (🟢 info, 🟠 warning, 🔴 error, 🟣 performance, 🔵 framework)
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
 * 🔴 = error, 🟠 = warning, 🟣 = performance, 🔵 = framework, 🟢 = info (default).
 * @param {string} level - Log level ('error', 'warning', 'performance', 'info')
 * @param {boolean} isFramework - Whether this is a framework log line
 */
function getLevelDot(level, isFramework) {
    if (level === 'error') return '\\ud83d\\udd34'; // 🔴 Red
    if (level === 'warning') return '\\ud83d\\udfe0'; // 🟠 Orange
    if (level === 'performance') return '\\ud83d\\udfe3'; // 🟣 Purple
    if (level === 'todo') return '\\u26aa'; // ⚪ White
    if (level === 'debug') return '\\ud83d\\udfe4'; // 🟤 Brown
    if (level === 'notice') return '\\ud83d\\udfe6'; // 🟦 Blue Square
    if (isFramework) return '\\ud83d\\udd35'; // 🔵 Blue Circle
    return '\\ud83d\\udfe2'; // 🟢 Green
}

/** Whether to show milliseconds in timestamps. */
var showMilliseconds = false;

/**
 * Format epoch ms to wall-clock time string (T07:23:36 or T07:23:36.123).
 * Returns empty string if timestamp is falsy (e.g. markers).
 */
function formatDecoTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = ('0' + d.getHours()).slice(-2);
    var m = ('0' + d.getMinutes()).slice(-2);
    var s = ('0' + d.getSeconds()).slice(-2);
    var result = 'T' + h + ':' + m + ':' + s;
    if (showMilliseconds) {
        var ms = ('00' + d.getMilliseconds()).slice(-3);
        result += '.' + ms;
    }
    return result;
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
 * Toggle inline context display on/off.
 */
function toggleInlineContext() {
    showInlineContext = !showInlineContext;
    renderViewport(true);
}

/**
 * Format inline context metadata as a breadcrumb.
 * Example: "src/utils/auth.ts:42 » login()"
 */
function formatInlineContext(item) {
    if (!showInlineContext || !item.context) return '';
    var parts = [];
    if (item.context.file) {
        // Shorten file path - show only last 2 segments
        var segments = item.context.file.split(/[\\/]/);
        var shortPath = segments.length > 2
            ? segments.slice(-2).join('/')
            : item.context.file;
        parts.push(shortPath);
        if (item.context.line) parts[0] += ':' + item.context.line;
    }
    if (item.context.func) {
        parts.push(item.context.func + '()');
    }
    if (parts.length === 0) return '';
    return '<span class="inline-context">' + parts.join(' \\u00BB ') + '</span>';
}

/**
 * Build the decoration prefix HTML for a single log line.
 * Only includes parts whose sub-toggle is enabled.
 * Returns empty string for markers, stack-frame sub-lines, or when off.
 *
 * Example output: <span class="line-decoration">🟢 #1 T07:23:36 » </span>
 */
function getDecorationPrefix(item) {
    if (!showDecorations && !showInlineContext) return '';
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return '';

    var result = '';

    // Standard decoration prefix
    if (showDecorations) {
        var parts = [];
        if (decoShowDot) parts.push(getLevelDot(item.level || 'info', !!item.fw));
        if (decoShowCounter) {
            var seqStr = item.seq !== undefined ? String(item.seq) : '?';
            parts.push('#' + seqStr.padStart(5, '&nbsp;'));
        }
        if (decoShowTimestamp) {
            var ts = formatDecoTimestamp(item.timestamp);
            if (ts) parts.push(ts);
        }
        if (parts.length > 0) {
            result += '<span class="line-decoration">'
                + parts.join('&nbsp; ') + '&nbsp; \\u00BB '
                + '</span>';
        }
    }

    // Inline context breadcrumb
    if (showInlineContext) {
        var ctx = formatInlineContext(item);
        if (ctx) result += ctx + '&nbsp; ';
    }

    return result;
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

// Register decoration button click handlers
var decoToggleBtn = document.getElementById('deco-toggle');
if (decoToggleBtn) {
    decoToggleBtn.addEventListener('click', toggleDecorations);
}
`;
}
