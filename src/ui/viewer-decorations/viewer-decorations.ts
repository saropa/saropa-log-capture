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
/** Last decoration signature (digit count + enabled-part flags + data-seen
    flags) applied to the CSS width vars; prevents repeated style writes on the
    scroll hot path. */
var lastAppliedDecoSig = '';
/** Which decoration data the loaded log actually contains. A decoration toggle
    being ON does not mean any line carries that data — a markdown/plain file
    has no timestamps, PIDs, or tags — so applyDecorationLayoutWidth() reserves
    a column's width only when both the toggle is on AND the data was seen.
    Set incrementally in addToData(); reset on 'clear'. */
var decoSeen = { ts: false, pidTid: false, tag: false, rawLevel: false };
/** Clear all decoration data-seen flags — called on 'clear', before a new file loads. */
function resetDecoSeen() { decoSeen.ts = false; decoSeen.pidTid = false; decoSeen.tag = false; decoSeen.rawLevel = false; }

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
 * that will ACTUALLY RENDER — a part counts only when its toggle is on AND the
 * loaded log actually carries that data (see decoSeen). A toggle being on does
 * NOT mean any line has the data: a markdown / plain-text / lint-report file
 * has no timestamps, PIDs, or tags, so reserving columns for them left a huge
 * empty gap between the severity bar and the message text. Each non-rendering
 * part now contributes zero width, so the gap shrinks to exactly what is shown.
 * Runs from renderViewport() plus addLines/clear; a digit+flag+data signature
 * skips the CSS write when nothing relevant changed, keeping it cheap on the
 * scroll hot path.
 */
function applyDecorationLayoutWidth() {
    var root = document.documentElement;
    if (!root || !root.style) return;
    var digits = getCounterDigitsForLayout();
    /* A part is reserved only when enabled AND present in the data. The counter
       is the exception — it uses the row index, so it always renders when on. */
    var hasCounter = decoShowCounter || decoShowCounterOnBlank;
    var hasTime = decoShowTimestamp && decoSeen.ts;
    var hasSessionElapsed = decoShowSessionElapsed && decoSeen.ts;
    var hasPid = (typeof showParsedPidTid !== 'undefined' && showParsedPidTid) && decoSeen.pidTid;
    var hasLvl = (typeof showParsedLevelPrefix !== 'undefined' && showParsedLevelPrefix) && decoSeen.rawLevel;
    /* Tag column: gated by its own toggle (Columns → Tag) AND by structuredLineParsing
       — without structured parsing the tag is never extracted into item.parsedTag, so a
       reserved column would always be empty. */
    var hasTag = (typeof decoShowParsedTag === 'undefined' || decoShowParsedTag)
        && (typeof structuredLineParsing !== 'undefined' && structuredLineParsing)
        && decoSeen.tag;
    /* Signature gates the CSS write: width depends on digit count, the enabled
       flags, AND which data has been seen (data arrives as lines stream in). */
    var sig = digits + '|' + (hasCounter ? 1 : 0) + (hasTime ? 1 : 0) + (showMilliseconds ? 1 : 0)
        + (hasSessionElapsed ? 1 : 0) + (hasPid ? 1 : 0) + (hasLvl ? 1 : 0) + (hasTag ? 1 : 0);
    if (sig === lastAppliedDecoSig) return;
    /* Per-part em widths at the .line parent font size. The deco prefix renders
       at font-size:0.85em; these are deliberately a touch generous because
       over-reserving only leaves a small gap, while under-reserving lets a part
       overlap the message. Tune via F5 if the gap reads too wide/tight. */
    var em = 0;
    /* Counter slot width = digits + the always-emitted .deco-chevron spacer
       that sits immediately right of the line number (see getCounterAffordance
       in viewer-data-divider.ts). The spacer claims a fixed inline-block
       width even when no glyph is rendered so the numeric column stays
       straight row-to-row. Reserving its width here is what keeps the
       message column aligned with .line-deco-spacer-only rows (stack-
       headers, stack-frames) — without this add, the spacer pushed the
       message right on regular rows but not on stack rows, so stack
       headers jutted ~1em to the left of the message column. The 1.0em
       is at parent .line font; chevron renders inside the deco prefix's
       0.85em font context (width 0.9em + margin-left 0.25em ≈ 0.98em
       parent), rounded up generously. */
    if (hasCounter) em += digits * 0.62 + 0.5 + 1.0;
    if (hasTime) em += showMilliseconds ? 7.5 : 5.5;
    if (hasSessionElapsed) em += 6.5;
    if (hasPid) em += 7;
    if (hasLvl) em += 1.6;
    if (hasTag) em += 7;
    if (em > 0) em += 1; // trailing &nbsp;&nbsp; gap getDecorationPrefix appends
    var contentIndentEm = em;
    var totalPaddingEm = 1.25 + contentIndentEm; // 1.25em keeps severity bar clear.
    root.style.setProperty('--deco-content-indent-em', contentIndentEm + 'em');
    root.style.setProperty('--deco-prefix-width-em', totalPaddingEm + 'em');
    lastAppliedDecoSig = sig;
}

/** Last successfully measured tag-column x-offset (px from .line left edge).
    Cached so divider chips on screens with no currently-visible parsed tag
    fall back to the last known good value instead of jumping to the default. */
var lastMeasuredTagLeftPx = -1;

/**
 * Measure the actual x-offset of a rendered .deco-parsed-tag relative to its
 * containing .line, and write it to --deco-tag-position-px on the document
 * root. Consumed by .viewer-divider chips (and dedup-badge / stack-toggle) so
 * they sit in the exact same x-column as real tags — no em-based estimation,
 * no drift when parts toggle on/off or the user zooms the log font.
 *
 * Skipped when no parsed tag is currently in the viewport: prior measurement
 * is preserved via lastMeasuredTagLeftPx so the chips don't jump.
 */
function measureTagColumnPosition() {
    var sample = document.querySelector('.line .deco-parsed-tag');
    if (!sample) return;
    var line = sample.closest('.line');
    if (!line) return;
    var tagRect = sample.getBoundingClientRect();
    var lineRect = line.getBoundingClientRect();
    var leftPx = tagRect.left - lineRect.left;
    if (!(leftPx > 0)) return;
    if (Math.abs(leftPx - lastMeasuredTagLeftPx) < 0.5) return; // unchanged
    lastMeasuredTagLeftPx = leftPx;
    document.documentElement.style.setProperty('--deco-tag-position-px', leftPx + 'px');
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
/**
 * hiddenAfter — when present, info about lines hidden BETWEEN this visible row
 * and the next. Drives the small ▶ chevron rendered immediately right of the
 * line number (see chevronInfo below). The chevron + counter form one click
 * target — the whole line-number area is interactive when any following
 * content is collapsed (filter-hidden gap, dedup-fold, stack collapse, etc.).
 * No floating chips, no tag replacement, no overlay collisions.
 */
function getDecorationPrefix(item, idx, hiddenAfter) {
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
        // Prefer the source-file line number stamped at line arrival in viewer-script-messages.ts.
        // idx is the position in allLines, which counts hidden stack-frame items, folded
        // async-gap markers, and synthetic chip rows — so idx+1 does NOT track the user's raw
        // file line. Fall back to idx+1 only when no source line is available (e.g. multi-part
        // sessions or in-memory streams where a single offset cannot represent the source).
        var lineNoSrc = (typeof item.sourceLineNo === 'number') ? item.sourceLineNo
            : ((typeof idx === 'number') ? (idx + 1) : (item.seq !== undefined ? item.seq : '?'));
        var seqStr = String(lineNoSrc);
        /* Build the chevron when this row owns any kind of hidden-content
           expand/collapse — a filter-hidden gap follows it, a stack-header
           with collapsed/preview frames, a dedup-fold survivor, etc.
           getCounterAffordance returns either an empty string (no chevron,
           plain counter) or the full clickable counter+chevron HTML with
           data-affordance-action / data-affordance-arg / title attrs the
           click delegate routes on. The line-number digits themselves are
           inside the wrapper so the whole numeric column is clickable. */
        var counterHtml = '<span class="deco-counter">' + seqStr.padStart(getCounterDigitsForLayout(), '\\u00a0') + '</span>';
        var affordance = (typeof getCounterAffordance === 'function')
            ? getCounterAffordance(item, idx, hiddenAfter, counterHtml) : '';
        parts.push(affordance || counterHtml);
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
    if (!isBlank && item.parsedTag
        && typeof structuredLineParsing !== 'undefined' && structuredLineParsing
        && (typeof decoShowParsedTag === 'undefined' || decoShowParsedTag)) {
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
