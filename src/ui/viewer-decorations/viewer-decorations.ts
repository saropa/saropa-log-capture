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
import { getDecorationsStateScript } from './viewer-decorations-state';

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
/** Last decoration signature (digit count + enabled-part flags) applied to the
    CSS width vars; prevents repeated style writes on the scroll hot path. */
var lastAppliedDecoSig = '';

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
 * Recompute the decorated-line prefix column width from the decoration parts
 * that are ACTUALLY enabled — counter, timestamp, session-elapsed, PID/TID,
 * level prefix, structured tag. Each disabled part contributes zero width, so
 * the gap between the severity bar and the message text shrinks to fit instead
 * of always reserving a static worst-case column (the old hardcoded 13em
 * reserved timestamp + PID + tag space even when only the counter was shown).
 * Runs from renderViewport() plus addLines/clear; a digit+flag signature skips
 * the CSS write when nothing relevant changed, keeping it cheap on the scroll
 * hot path.
 */
function applyDecorationLayoutWidth() {
    var root = document.documentElement;
    if (!root || !root.style) return;
    var digits = getCounterDigitsForLayout();
    var showPid = (typeof showParsedPidTid !== 'undefined' && showParsedPidTid);
    var showLvl = (typeof showParsedLevelPrefix !== 'undefined' && showParsedLevelPrefix);
    var showTag = (typeof structuredLineParsing !== 'undefined' && structuredLineParsing);
    /* Signature gates the CSS write: width now depends on digit count AND which
       parts are enabled, so the old digits-only key would miss flag toggles. */
    var sig = digits + '|' + (decoShowCounter ? 1 : 0) + (decoShowCounterOnBlank ? 1 : 0)
        + (decoShowTimestamp ? 1 : 0) + (showMilliseconds ? 1 : 0) + (decoShowSessionElapsed ? 1 : 0)
        + (showPid ? 1 : 0) + (showLvl ? 1 : 0) + (showTag ? 1 : 0);
    if (sig === lastAppliedDecoSig) return;
    /* Per-part em widths at the .line parent font size. The deco prefix renders
       at font-size:0.85em; these are deliberately a touch generous because
       over-reserving only leaves a small gap, while under-reserving lets a part
       overlap the message. Tune via F5 if the gap reads too wide/tight. */
    var em = 0;
    if (decoShowCounter || decoShowCounterOnBlank) em += digits * 0.62 + 0.5;
    if (decoShowTimestamp) em += showMilliseconds ? 7.5 : 5.5;
    if (decoShowSessionElapsed) em += 6.5;
    if (showPid) em += 7;
    if (showLvl) em += 1.6;
    if (showTag) em += 7;
    if (em > 0) em += 1; // trailing &nbsp;&nbsp; gap getDecorationPrefix appends
    var contentIndentEm = em;
    var totalPaddingEm = 1.25 + contentIndentEm; // 1.25em keeps severity bar clear.
    root.style.setProperty('--deco-content-indent-em', contentIndentEm + 'em');
    root.style.setProperty('--deco-prefix-width-em', totalPaddingEm + 'em');
    lastAppliedDecoSig = sig;
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
    if (!isBlank && typeof showParsedPidTid !== 'undefined' && showParsedPidTid) {
        var pidParts = [];
        if (item.parsedPid != null) pidParts.push('<span class="meta-filter-toggle" data-meta-key="pid" data-meta-value="' + item.parsedPid + '" title="Filter by PID ' + item.parsedPid + '">' + item.parsedPid + '</span>');
        if (item.parsedTid != null) pidParts.push('<span class="meta-filter-toggle" data-meta-key="tid" data-meta-value="' + item.parsedTid + '" title="Filter by TID ' + item.parsedTid + '">' + item.parsedTid + '</span>');
        if (pidParts.length) parts.push('<span class="deco-pid-tid">[' + pidParts.join(':') + ']</span>');
    }
    if (!isBlank && typeof showParsedLevelPrefix !== 'undefined' && showParsedLevelPrefix && item.parsedRawLevel) {
        parts.push('<span class="deco-level-prefix">' + item.parsedRawLevel + '</span>');
    }
    if (!isBlank && item.parsedTag && typeof structuredLineParsing !== 'undefined' && structuredLineParsing) {
        parts.push('<span class="meta-filter-toggle deco-parsed-tag" data-meta-key="tag" data-meta-value="' + item.parsedTag.replace(/"/g, '&quot;') + '" title="Filter by tag: ' + item.parsedTag.replace(/"/g, '&quot;') + '">' + item.parsedTag + '</span>');
    }
    if (parts.length === 0) return '';
    /* WHY no '»' chevron: with --deco-prefix-width-em + hanging-indent, the
       content column is visually obvious without a separator glyph. The chevron
       was redundant and added noise on every line. Two trailing &nbsp; keep a
       small whitespace gap between the prefix and the message body so the
       columns don't visually touch when the timestamp ends in a digit.
       Copy output (viewer-copy.ts) still emits '»' because plain text has no
       columns to anchor against — the chevron survives there as a separator. */
    return '<span class="line-decoration">'
        + parts.join('&nbsp; ') + '&nbsp;&nbsp;'
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
` + getDecorationsStateScript();
}
