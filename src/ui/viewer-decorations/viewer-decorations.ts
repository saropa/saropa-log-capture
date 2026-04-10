/**
 * Client-side JavaScript for log line decoration prefixes in the viewer.
 *
 * Prefixes each line with a configurable combination of:
 *   - Colored severity dot (🟢 info, 🟠 warning, 🔴 error, 🟣 performance, 🔵 framework)
 *   - Sequential counter (1, 2, ...)
 *   - Wall-clock timestamp (T07:23:36)
 *   - Session elapsed time (e.g. 5m 15s)
 *
 * Also provides whole-line severity tinting (subtle background colors).
 *
 * All rendering is viewer-only — log files on disk are never modified.
 * Individual toggles (decoShowDot, decoShowCounter, decoShowTimestamp, etc.)
 * and decoLineColorMode are declared in viewer-deco-settings.ts and shared
 * via the concatenated script scope. areDecorationsOn() returns true when
 * any individual toggle is active.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getDecorationsScript(): string {
    return /* javascript */ `
/**
 * Derived check — decorations are on when any sub-toggle is active.
 * Replaces the former master switch; individual options now stand alone.
 */
function areDecorationsOn() {
    return decoShowDot || decoShowCounter || decoShowCounterOnBlank
        || decoShowTimestamp || showElapsed || decoShowSessionElapsed
        || decoShowBar || (decoLineColorMode !== 'none')
        || (typeof decoShowQuality !== 'undefined' && decoShowQuality)
        || (typeof showCategoryBadges !== 'undefined' && showCategoryBadges)
        || (typeof decoShowLintBadges !== 'undefined' && decoShowLintBadges);
}

/** Epoch ms of the first timestamped line — used for session elapsed display. */
var sessionStartTs = 0;
/** Last digit count applied to CSS vars; prevents repeated style writes in hot paths. */
var lastAppliedCounterDigits = -1;

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
 * Format session-elapsed ms as duration with unit suffixes (e.g. 5m 15s, 1h 5m 15s).
 * Unambiguous as elapsed time, not clock time. Hours appear when elapsed >= 1h; days when >= 24h.
 * Respects the showMilliseconds toggle for sub-second precision on the seconds part.
 */
function formatSessionElapsed(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var sec = totalSec % 60;
    var totalMin = Math.floor(totalSec / 60);
    var min = totalMin % 60;
    var totalHr = Math.floor(totalMin / 60);
    var hr = totalHr % 24;
    var days = Math.floor(totalHr / 24);
    var msFrac = showMilliseconds ? '.' + ('00' + (ms % 1000)).slice(-3) : '';
    var sPart = sec + msFrac + 's';
    if (totalHr >= 24) {
        var mm = ('0' + min).slice(-2);
        return days + 'd ' + hr + 'h ' + mm + 'm ' + sPart;
    }
    if (totalHr >= 1) {
        var mm = ('0' + min).slice(-2);
        return hr + 'h ' + mm + 'm ' + sPart;
    }
    if (totalMin >= 1) {
        return min + 'm ' + sPart;
    }
    return sPart;
}

/**
 * Reset all sub-toggles to their defaults.
 * Used by the options panel "Reset to defaults" action.
 */
function resetDecoDefaults() {
    decoShowDot = true;
    decoShowCounter = true;
    decoShowCounterOnBlank = false;
    decoShowTimestamp = true;
    decoShowSessionElapsed = false;
    decoLineColorMode = 'none';
    decoShowBar = true;
    stripSourceTagPrefix = true;
    stackDefaultState = false;
    stackPreviewCount = 3;
}

/**
 * Compute counter digit width from the current max line number.
 * Keeps a 5-char minimum, then grows for 6+ digits.
 */
function getCounterDigitsForLayout() {
    var maxCount = 0;
    if (typeof lineCount === 'number' && lineCount > 0) {
        maxCount = lineCount;
    } else if (typeof allLines !== 'undefined' && allLines && allLines.length > 0) {
        maxCount = allLines.length;
    }
    var digits = String(Math.max(1, maxCount)).length;
    return Math.max(5, digits);
}

/**
 * Keep decorated-line hanging indent in sync with counter digit width.
 * Base layout assumes up to 4 digits; add 1em per extra digit.
 * Runs often while streaming, so skip CSS writes unless digit width changed.
 */
function applyDecorationLayoutWidth() {
    var root = document.documentElement;
    if (!root || !root.style) return;
    var digits = getCounterDigitsForLayout();
    if (digits === lastAppliedCounterDigits) return;
    var extraDigits = Math.max(0, digits - 4);
    var contentIndentEm = 13 + extraDigits;
    var totalPaddingEm = 1.25 + contentIndentEm; // 1.25em keeps severity bar clear.
    root.style.setProperty('--deco-content-indent-em', contentIndentEm + 'em');
    root.style.setProperty('--deco-prefix-width-em', totalPaddingEm + 'em');
    lastAppliedCounterDigits = digits;
}

/** Update the Deco button style and tooltip to reflect whether any decoration is active. */
function updateDecoButton() {
    var btn = document.getElementById('deco-toggle');
    if (!btn) return;
    var on = areDecorationsOn();
    btn.title = on
        ? 'Decorations ON (click gear to configure)'
        : 'Decorations OFF (click gear to configure)';
    if (on) {
        btn.classList.remove('toggle-inactive');
    } else {
        btn.classList.add('toggle-inactive');
    }
}

/**
 * Build the decoration prefix HTML for a single log line.
 * Only includes parts whose sub-toggle is enabled.
 * Returns empty string for markers, stack-frame sub-lines, or when off.
 * Blank lines: no prefix by default; optional decoShowCounterOnBlank shows file line number.
 * Counter uses file line number (idx+1) when available so sequencing never skips.
 *
 * Example output: <span class="line-decoration"><span class="deco-counter">    1</span> T07:23:36 » </span>
 * (Emoji dot is only used in Copy with decorations, not in the viewer.)
 */
function getDecorationPrefix(item, idx) {
    if (!areDecorationsOn()) return '';
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return '';

    var isBlank = typeof isLineContentBlank === 'function' && isLineContentBlank(item);
    if (isBlank && (typeof decoShowCounterOnBlank === 'undefined' || !decoShowCounterOnBlank)) return '';

    var parts = [];
    // Emoji dots are NOT shown in the visual prefix — the CSS severity bar
    // (level-bar-*) is the visual indicator. Emoji dots appear only in
    // decorated copy format (see decorateLine() in viewer-copy.ts).
    /* Show counter when Counter is on, or when blank and "Show line number on blank lines" is on. */
    if (decoShowCounter || (isBlank && decoShowCounterOnBlank)) {
        var seqStr = (typeof idx === 'number') ? String(idx + 1) : (item.seq !== undefined ? String(item.seq) : '?');
        parts.push('<span class="deco-counter">' + seqStr.padStart(getCounterDigitsForLayout(), '\\u00a0') + '</span>');
    }
    if (!isBlank && decoShowTimestamp) {
        var ts = formatDecoTimestamp(item.timestamp);
        if (ts) parts.push(ts);
    }
    if (!isBlank && decoShowSessionElapsed && item.timestamp && sessionStartTs) {
        parts.push(formatSessionElapsed(item.timestamp - sessionStartTs));
    }
    if (parts.length === 0) return '';
    return '<span class="line-decoration">'
        + parts.join('&nbsp; ') + '&nbsp;\\u00BB '
        + '</span>';
}

/**
 * Return a CSS class for whole-line severity tinting.
 * Only active when decoLineColorMode is 'line' and decorations are on.
 */
function getLineTintClass(item) {
    if (decoLineColorMode !== 'line') return '';
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return '';
    if (item.level) return ' line-tint-' + item.level;
    return '';
}

// Register decoration button click — opens settings panel directly
var decoToggleBtn = document.getElementById('deco-toggle');
if (decoToggleBtn) {
    decoToggleBtn.addEventListener('click', function() {
        if (typeof toggleDecoSettings === 'function') toggleDecoSettings();
    });
}
applyDecorationLayoutWidth();
`;
}
