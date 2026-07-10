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
import { getDecoContentScript } from './viewer-deco-content';

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
var decoSeen = { ts: false, pidTid: false, tag: false, rawLevel: false, htags: false };
/** Clear all decoration data-seen flags — called on 'clear', before a new file loads. */
function resetDecoSeen() { decoSeen.ts = false; decoSeen.pidTid = false; decoSeen.tag = false; decoSeen.rawLevel = false; decoSeen.htags = false; }

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
    /* One tag column, one tag set (item.tags): every per-line tag — device/logcat/
       source + bracket head tags — renders as a chip here (buildDecoParts).
       decoSeen.htags is true once any line carries a tag; the Columns "Tag" toggle
       (decoShowParsedTag) still hides the whole column. */
    var hasTag = (typeof decoShowParsedTag === 'undefined' || decoShowParsedTag) && decoSeen.htags;
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
    /* Tag column holds the line's chips (device/logcat/source + head tags). 12em
       fits the common one/two-chip line without cutting names to "Activi…"; it is
       a shared fixed width so the message stays aligned row-to-row, and a rare
       busier line clips with the full list on the cell tooltip. */
    if (hasTag) em += 12;
    if (em > 0) em += 1; // trailing &nbsp;&nbsp; gap getDecorationPrefix appends
    var contentIndentEm = em;
    var totalPaddingEm = 1.25 + contentIndentEm; // 1.25em keeps severity bar clear.
    root.style.setProperty('--deco-content-indent-em', contentIndentEm + 'em');
    root.style.setProperty('--deco-prefix-width-em', totalPaddingEm + 'em');
    /* Grid template (plan 055): one track per decoration part — ALWAYS all six
       tracks emitted (absent parts at width 0) so the fixed grid-column indices
       in viewer-styles-columns.ts stay valid even on rows that omit a part, plus
       a 1fr message track. Same per-part em widths as the legacy sum above; the
       cells clip, so a too-narrow estimate clips rather than overlapping. */
    var gridCols = [
        hasCounter ? (digits * 0.62 + 0.5 + 1.0) + 'em' : '0',
        hasTime ? (showMilliseconds ? 7.5 : 5.5) + 'em' : '0',
        hasSessionElapsed ? '6.5em' : '0',
        hasPid ? '7em' : '0',
        hasLvl ? '1.6em' : '0',
        hasTag ? '12em' : '0',
        '1fr',
    ];
    root.style.setProperty('--grid-cols', gridCols.join(' '));
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

/* Decoration content builders (getCategoryBadge, buildDecoParts,
   getDecorationPrefix, getDecorationCells) live in viewer-deco-content.ts —
   concatenated below via getDecoContentScript() — to keep this file under the
   300-LOC cap after the grid-cell renderer was added (plan 055). */

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
` + getDecoContentScript() + getDecorationsStateScript();
}
