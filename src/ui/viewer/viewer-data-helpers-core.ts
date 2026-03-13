/**
 * Core viewer data helpers: escapeHtml, repeat tracking, separator/context detection, calcItemHeight.
 * Extracted to keep viewer-data-helpers.ts under the line limit.
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
    lastLineIndex: -1
};
var anrPattern = /\\b(anr|application\\s+not\\s+responding|input\\s+dispatching\\s+timed\\s+out)\\b/i;
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
}
function isSeparatorLine(plainText) {
    var trimmed = plainText.trim();
    if (trimmed.length < 3) return false;
    var artChars = /[=+*_#~|/\\\\\\\\<>\\\\[\\\\]{}()^v─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬\\\\-]/;
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
    if (item.filteredOut || item.excluded || item.levelFiltered || item.sourceFiltered || item.classFiltered || item.searchFiltered || item.errorSuppressed || item.scopeFiltered || item.repeatHidden || item.userHidden) return 0;
    if (typeof hideBlankLines !== 'undefined' && hideBlankLines && item.type === 'line' && isLineContentBlank(item)) return 0;
    if (item.type === 'marker') return MARKER_HEIGHT;
    if (item.type === 'run-separator') return (typeof RUN_SEPARATOR_HEIGHT !== 'undefined') ? RUN_SEPARATOR_HEIGHT : 72;
    var isAppOnly = (typeof appOnlyMode !== 'undefined' && appOnlyMode);
    if (item.type === 'stack-frame' && item.groupId >= 0) {
        var header = (typeof groupHeaderMap !== 'undefined') ? groupHeaderMap[item.groupId] : null;
        if (!header) return 0;
        if (header.collapsed === true) return 0;
        if (header.collapsed === false) {
            return (isAppOnly && item.fw) ? 0 : ROW_HEIGHT;
        }
        if (header.collapsed === 'preview') {
            if (item.fw) return 0;
            var appIdx = (item._appFrameIdx !== undefined) ? item._appFrameIdx : -1;
            return (appIdx >= 0 && appIdx < (header.previewCount || 3)) ? ROW_HEIGHT : 0;
        }
        return 0;
    }
    if (isAppOnly && item.fw) return 0;
    return ROW_HEIGHT;
}
`;
}
