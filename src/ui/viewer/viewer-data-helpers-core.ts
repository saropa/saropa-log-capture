/**
 * Core viewer data helpers: escapeHtml, repeat tracking, separator/context detection, calcItemHeight.
 *
 * SQL drilldown UI functions (DB_06) live in viewer-data-sql-drilldown-ui.ts.
 * Drift N+1 burst detection lives in viewer-data-n-plus-one-script.ts.
 */
export function getViewerDataHelpersCore(): string {
    return /* javascript */ `
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
var repeatTracker = {
    lastHash: null,
    lastPlainText: null,
    lastLevel: null,
    count: 0,
    lastTimestamp: 0,
    lastLineIndex: -1,
    /** Minimum occurrences before repeat-collapse for the current streak (Drift verb–specific or global). */
    streakMinN: 2,
    /** True when current streak uses SQL fingerprint repeat key (database + parseSqlFingerprint). */
    streakSqlFp: false,
    /** Truncated sqlSnippet for repeat row preview when streakSqlFp. */
    sqlRepeatPreview: null,
    /** Fingerprint for the active SQL streak (DB_06 drilldown snapshot). */
    sqlStreakFingerprint: null,
    /** Full snippet capped for drilldown storage (not the short repeat-preview string). */
    sqlStreakSqlSnippet: '',
    sqlStreakFirstTs: 0,
    sqlStreakLastTs: 0,
    /** Distinct argsKey values in first-seen order (parallel counts in sqlStreakVariantCounts). */
    sqlStreakVariantOrder: [],
    sqlStreakVariantCounts: null,
    // Index in allLines of the single repeat-notification row for the active streak (updated in place).
    lastRepeatNotificationIndex: -1
};
var anrPattern = /\\b(anr|application\\s+not\\s+responding|input\\s+dispatching\\s+timed\\s+out)\\b/i;
/** Tracks consecutive separator lines with the same timestamp for art-block grouping. */
var artBlockTracker = { startIdx: -1, timestamp: 0, count: 0 };
/** Finalize an open art block: tag each line with its position ('start', 'middle', 'end'). */
function finalizeArtBlock() {
    if (artBlockTracker.count < 2 || artBlockTracker.startIdx < 0) {
        artBlockTracker.startIdx = -1;
        artBlockTracker.count = 0;
        return;
    }
    var end = artBlockTracker.startIdx + artBlockTracker.count - 1;
    for (var ai = artBlockTracker.startIdx; ai <= end; ai++) {
        var it = allLines[ai];
        if (ai === artBlockTracker.startIdx) it.artBlockPos = 'start';
        else if (ai === end) it.artBlockPos = 'end';
        else it.artBlockPos = 'middle';
    }
    artBlockTracker.startIdx = -1;
    artBlockTracker.count = 0;
}
var repeatWindowMs = 3000;
var repeatPreviewLength = 85;
function generateRepeatHash(level, plainText) {
    var preview = plainText.substring(0, 200).trim();
    if (!preview) return null;
    return level + '::' + preview;
}
function cleanupTrailingRepeats() {
    if (repeatTracker.count <= 1 || repeatTracker.lastLineIndex < 0) return;
    if (repeatTracker.lastLineIndex < allLines.length) {
        var orig = allLines[repeatTracker.lastLineIndex];
        /* SQL path: original was hidden behind a notification row — restore it. */
        if (orig && orig.repeatHidden) {
            orig.repeatHidden = false;
            orig.height = calcItemHeight(orig);
            totalHeight += orig.height;
        }
        /* Non-SQL path: all duplicate lines are stored in allLines normally;
           the compress dedup algorithm handles grouping. No cleanup needed. */
    }
    /* SQL path: hide trailing notification rows that were replaced by the restored original. */
    for (var ri = allLines.length - 1; ri >= 0; ri--) {
        if (allLines[ri].type !== 'repeat-notification') break;
        totalHeight -= allLines[ri].height;
        allLines[ri].height = 0;
    }
    repeatTracker.lastHash = null;
    repeatTracker.lastPlainText = null;
    repeatTracker.lastLevel = null;
    repeatTracker.count = 0;
    repeatTracker.lastTimestamp = 0;
    repeatTracker.lastLineIndex = -1;
    repeatTracker.streakMinN = 2;
    repeatTracker.streakSqlFp = false;
    repeatTracker.sqlRepeatPreview = null;
    repeatTracker.sqlStreakFingerprint = null;
    repeatTracker.sqlStreakSqlSnippet = '';
    repeatTracker.sqlStreakFirstTs = 0;
    repeatTracker.sqlStreakLastTs = 0;
    repeatTracker.sqlStreakVariantOrder = [];
    repeatTracker.sqlStreakVariantCounts = null;
    repeatTracker.lastRepeatNotificationIndex = -1;
}
/**
 * Separator / banner detection for .separator-line CSS. Must match
 * isLogViewerSeparatorLine in modules/analysis/log-viewer-separator-line.ts (unit-tested there).
 * Both copies strip the logcat/bracket prefix before detection — keep separatorPrefixRe in sync
 * with SOURCE_PREFIX in the TS module.
 *
 * Detection has two branches:
 * 1. Bar-pair: a vertical bar char on each side (any of │┃║╎╏╽╿), content between.
 * 2. Pure box-drawing rule: every non-whitespace char is in the Unicode box-drawing
 *    block (U+2500–U+257F). Covers rounded (╭╮╰╯), T-connector (├┤), heavy (┏┗┛┓),
 *    mixed light/heavy and light/double variants that corner-specific sets miss.
 */
function isAsciiBoxDrawingDecorLine(plain) {
    if (/^\\s*[\\u2502\\u2503\\u2551\\u254E\\u254F\\u257D\\u257F]\\s+(?:.*\\S\\s*)?[\\u2502\\u2503\\u2551\\u254E\\u254F\\u257D\\u257F]\\s*$/.test(plain)) return true;
    /* Pure box-drawing rule line (≥ 2 box chars, only whitespace allowed between). */
    return /^\\s*[\\u2500-\\u257F][\\u2500-\\u257F\\s]*[\\u2500-\\u257F]\\s*$/.test(plain);
}
/** Strip logcat / bracket prefix so separator detection works on the message body. */
var separatorPrefixRe = /^(?:[VDIWEFA]\\/[^(:\\s]+\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[[^\\]]+\\]\\s)/;
function isSeparatorLine(plainText) {
    var prefixM = separatorPrefixRe.exec(plainText);
    var body = prefixM ? plainText.slice(prefixM[0].length) : plainText;
    if (isAsciiBoxDrawingDecorLine(body)) return true;
    var trimmed = body.trim();
    if (trimmed.length < 3) return false;
    /* Art-char set: ASCII decoration symbols + full Unicode box-drawing block
       (U+2500–U+257F) + block elements (U+2580–U+259F) for shaded art. */
    var artChars = /[=+*_#~|/\\\\\\\\<>\\\\[\\\\]{}()^v\\u2500-\\u257F\\u2580-\\u259F\\\\-]/;
    var artCount = 0;
    for (var i = 0; i < trimmed.length; i++) {
        if (artChars.test(trimmed[i]) || trimmed[i] === ' ') artCount++;
    }
    return (artCount / trimmed.length) >= 0.6;
}
function extractContext(plainText) {
    var atMatch = /at\\s+(?:(.+?)\\s+\\()?([^\\s()]+?):(\\d+)(?::(\\d+))?\\)?/.exec(plainText);
    if (atMatch) {
        return { file: atMatch[2] || '', func: atMatch[1] || '', line: atMatch[3] || '' };
    }
    var mozMatch = /([^@]+)@([^:]+):(\\d+)(?::(\\d+))?/.exec(plainText);
    if (mozMatch) {
        return { file: mozMatch[2] || '', func: mozMatch[1] || '', line: mozMatch[3] || '' };
    }
    return null;
}
/** True if line has no content or only whitespace (spaces, tabs, Unicode whitespace). */
function isLineContentBlank(item) {
    if (!item || !item.html) return true;
    var text = stripTags(item.html);
    return /^\\s*$/.test(text);
}
function calcItemHeight(item) {
    /* peekOverride: scoped peek from clicking a hidden-chevron (viewer-peek-chevron.ts).
       Bypasses every filter/hide gate so the user can reveal exactly one gap's worth of
       hidden lines without disturbing the global filter state. Does NOT override
       continuation/stack-group collapse — those are explicit user actions, not filters. */
    if (!item.peekOverride) {
        if (item.filteredOut || item.excluded || item.levelFiltered || item.sourceFiltered || item.classFiltered || item.sqlPatternFiltered || item.searchFiltered || item.errorSuppressed || item.scopeFiltered || item.repeatHidden || item.compressDupHidden || item.metadataFiltered) return 0;
        if (item.type === 'line' && item.timeRangeFiltered) return 0;
        var _peeking = (typeof isPeeking !== 'undefined' && isPeeking);
        if (!_peeking && (item.userHidden || item.autoHidden)) return 0;
    }
    if (item.contIsChild && item.contGroupId >= 0 && typeof contHeaderMap !== 'undefined') {
        var contHdr = contHeaderMap[item.contGroupId];
        if (contHdr && contHdr.contCollapsed) return 0;
    }
    /* Blank lines always render at quarter height — compact enough to not
     * waste space, tall enough to preserve paragraph breaks. Placed after
     * the continuation-collapse gate so collapsed children stay fully hidden. */
    if (item.type === 'line' && isLineContentBlank(item)) return Math.max(4, Math.floor(ROW_HEIGHT / 4));
    /* ASCII art block rows use a compact height so consecutive box-drawing
       strokes (│, ║, ─) connect without visible gaps. Matches the CSS in
       viewer-styles-ascii-art.ts: start/end = 1em + 6px padding, middle = 1em.
       WHY logFontSize and not ROW_HEIGHT: ROW_HEIGHT is measured from a .line
       probe with line-height 1.5 (base rule), but art-block lines override to
       line-height 1. Returning ROW_HEIGHT here would leave ~0.5em of empty
       space below each art row and the scroller's prefix sums would be taller
       than the rendered block, producing drift in subsequent row positions. */
    if (item.artBlockPos === 'start' || item.artBlockPos === 'end') return logFontSize + 6;
    if (item.artBlockPos === 'middle') return logFontSize;
    /* Structured file collapse (plan 051): markdown sections and JSON brace pairs. */
    if (item._mdSectionHidden || item._jsonSectionHidden) return 0;
    if (item.type === 'marker') {
        /* markerHidden / markerCollapsed are set by applyDbSignalMarkerVisibility and
           applyConsecutiveDbMarkerCollapse (viewer-data-marker-filter). Honouring them here
           is the single source of truth for marker visibility — without this gate, collapsed
           or orphaned db-signal markers still occupy a row despite the filter pass running. */
        if (item.markerHidden || item.markerCollapsed) return 0;
        return MARKER_HEIGHT;
    }
    if (item.type === 'run-separator') return (typeof RUN_SEPARATOR_HEIGHT !== 'undefined') ? RUN_SEPARATOR_HEIGHT : 72;
    var _tierHidden = (typeof isTierHidden === 'function') ? isTierHidden(item) : false;
    if (item.type === 'stack-frame' && item.groupId >= 0) {
        var header = (typeof groupHeaderMap !== 'undefined') ? groupHeaderMap[item.groupId] : null;
        if (!header) return 0;
        if (header.collapsed === true) return 0;
        if (header.collapsed === false) {
            return (_tierHidden) ? 0 : ROW_HEIGHT;
        }
        if (header.collapsed === 'preview') {
            if (item.fw) return 0;
            var appIdx = (item._appFrameIdx !== undefined) ? item._appFrameIdx : -1;
            return (appIdx >= 0 && appIdx < (header.previewCount || 3)) ? ROW_HEIGHT : 0;
        }
        return 0;
    }
    /* Tier hide is a filter, not an explicit collapse — peekOverride bypasses it too. */
    if (_tierHidden && !item.peekOverride) return 0;
    if (item.type === 'repeat-notification' && item.sqlRepeatDrilldown && item.sqlRepeatDrilldownOpen) {
        return ROW_HEIGHT + estimateSqlRepeatDrilldownExtraHeight(item.sqlRepeatDrilldown);
    }
    return ROW_HEIGHT;
}
`;
}
