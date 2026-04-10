"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerDataHelpersCore = getViewerDataHelpersCore;
/**
 * Core viewer data helpers: escapeHtml, repeat tracking, separator/context detection, calcItemHeight.
 *
 * SQL drilldown UI functions (DB_06) live in viewer-data-sql-drilldown-ui.ts.
 * Drift N+1 burst detection lives in viewer-data-n-plus-one-script.ts.
 */
function getViewerDataHelpersCore() {
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
        if (orig && orig.repeatHidden) {
            orig.repeatHidden = false;
            orig.height = calcItemHeight(orig);
            totalHeight += orig.height;
        }
    }
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
 */
function isAsciiBoxDrawingDecorLine(plain) {
    return /^\\s*[\\u2502\\u2551]\\s+(?:.*\\S\\s*)?[\\u2502\\u2551]\\s*$/.test(plain);
}
/** Strip logcat / bracket prefix so separator detection works on the message body. */
var separatorPrefixRe = /^(?:[VDIWEFA]\\/[^(:\\s]+\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[[^\\]]+\\]\\s)/;
function isSeparatorLine(plainText) {
    var prefixM = separatorPrefixRe.exec(plainText);
    var body = prefixM ? plainText.slice(prefixM[0].length) : plainText;
    if (isAsciiBoxDrawingDecorLine(body)) return true;
    var trimmed = body.trim();
    if (trimmed.length < 3) return false;
    /* Light arcs / corners used in Drift and other Unicode box art (not only ┌┐). */
    var artChars = /[=+*_#~|/\\\\\\\\<>\\\\[\\\\]{}()^v─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╯╰\\\\-]/;
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
    // Multi-source filter: hide line if its source is not in the enabled set (e.g. "Just debug").
    if (typeof window !== 'undefined' && window.enabledSources && item.source && window.enabledSources.indexOf(item.source) < 0) return 0;
    if (item.filteredOut || item.excluded || item.levelFiltered || item.sourceFiltered || item.classFiltered || item.sqlPatternFiltered || item.searchFiltered || item.errorSuppressed || item.scopeFiltered || item.repeatHidden || item.compressDupHidden) return 0;
    if (item.type === 'line' && item.timeRangeFiltered) return 0;
    var _peeking = (typeof isPeeking !== 'undefined' && isPeeking);
    if (!_peeking && (item.userHidden || item.autoHidden)) return 0;
    var hideBlanks = (typeof hideBlankLines !== 'undefined' && hideBlankLines);
    if (hideBlanks && item.type === 'line' && isLineContentBlank(item)) return 0;
    if (item.contIsChild && item.contGroupId >= 0 && typeof contHeaderMap !== 'undefined') {
        var contHdr = contHeaderMap[item.contGroupId];
        if (contHdr && contHdr.contCollapsed) return 0;
    }
    if (item.type === 'marker') return MARKER_HEIGHT;
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
    if (_tierHidden) return 0;
    if (item.type === 'repeat-notification' && item.sqlRepeatDrilldown && item.sqlRepeatDrilldownOpen) {
        return ROW_HEIGHT + estimateSqlRepeatDrilldownExtraHeight(item.sqlRepeatDrilldown);
    }
    return ROW_HEIGHT;
}
`;
}
//# sourceMappingURL=viewer-data-helpers-core.js.map