/**
 * Core viewer data helpers: escapeHtml, repeat tracking, separator/context detection, calcItemHeight.
 * Extracted to keep viewer-data-helpers.ts under the line limit.
 *
 * **DB_06 (SQL repeat drilldown)** — Embedded functions below the template literal also include:
 * - `repeatTracker` fields that accumulate **first-seen** `argsKey` variants and capped SQL snippet text
 *   while a `database` + fingerprint repeat streak is active.
 * - `snapshotSqlRepeatDrilldown(ts)` — immutable per-row payload attached to each emitted SQL
 *   `repeat-notification` (see `viewer-data-add.ts`).
 * - `buildSqlRepeatNotificationRowHtml` / `toggleSqlRepeatDrilldown` — collapsible UI; heights use
 *   `estimateSqlRepeatDrilldownExtraHeight` (heuristic, not DOM-measured) plus `recalcHeights` after toggle.
 * - **Single repeat row per streak:** `repeatTracker.lastRepeatNotificationIndex` points at the one
 *   `repeat-notification` line updated as `count` grows; `trimData` / clear / `cleanupTrailingRepeats` reset it.
 * - **Security:** all user-derived strings in the detail panel go through `escapeHtml`; `data-seq` is numeric.
 *
 * Drift N+1 burst detection lives in `viewer-data-n-plus-one-script.ts` (loaded before this chunk).
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
var SQL_REPEAT_DRILLDOWN_MAX_SAMPLES = 10;
var SQL_REPEAT_SNIPPET_STORE_CAP = 500;
var SQL_REPEAT_ARG_KEY_CAP = 220;
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
function resetSqlStreakVariantAccumulators() {
    repeatTracker.sqlStreakVariantOrder = [];
    repeatTracker.sqlStreakVariantCounts = Object.create(null);
}
function bumpSqlStreakVariant(argsKey) {
    if (!repeatTracker.sqlStreakVariantCounts) repeatTracker.sqlStreakVariantCounts = Object.create(null);
    var ak = argsKey != null && argsKey !== '' ? String(argsKey) : '[]';
    if (!repeatTracker.sqlStreakVariantCounts[ak]) {
        repeatTracker.sqlStreakVariantCounts[ak] = 0;
        repeatTracker.sqlStreakVariantOrder.push(ak);
    }
    repeatTracker.sqlStreakVariantCounts[ak]++;
}
function capSqlSnippetForDrilldown(s) {
    var t = s != null ? String(s) : '';
    if (t.length <= SQL_REPEAT_SNIPPET_STORE_CAP) return t;
    return t.substring(0, SQL_REPEAT_SNIPPET_STORE_CAP - 3) + '...';
}
function capArgKeyForDrilldown(s) {
    var t = s != null ? String(s) : '[]';
    if (t.length <= SQL_REPEAT_ARG_KEY_CAP) return t;
    return t.substring(0, SQL_REPEAT_ARG_KEY_CAP - 3) + '...';
}
/** Immutable snapshot for one emitted SQL repeat-notification row (DB_06). */
function snapshotSqlRepeatDrilldown(ts) {
    var order = repeatTracker.sqlStreakVariantOrder || [];
    var counts = repeatTracker.sqlStreakVariantCounts || {};
    var variants = [];
    var i;
    for (i = 0; i < order.length && variants.length < SQL_REPEAT_DRILLDOWN_MAX_SAMPLES; i++) {
        var rawAk = order[i];
        variants.push({ argsKey: capArgKeyForDrilldown(rawAk), count: counts[rawAk] || 0 });
    }
    var moreVariantCount = order.length > SQL_REPEAT_DRILLDOWN_MAX_SAMPLES ? order.length - SQL_REPEAT_DRILLDOWN_MAX_SAMPLES : 0;
    return {
        fingerprint: repeatTracker.sqlStreakFingerprint || '',
        sqlSnippet: capSqlSnippetForDrilldown(repeatTracker.sqlStreakSqlSnippet || ''),
        firstTs: repeatTracker.sqlStreakFirstTs,
        lastTs: ts || repeatTracker.sqlStreakLastTs || repeatTracker.sqlStreakFirstTs,
        variants: variants,
        moreVariantCount: moreVariantCount,
        repeatCount: repeatTracker.count
    };
}
function formatSqlRepeatDrilldownTs(ms) {
    if (ms == null || !isFinite(ms)) return '\\u2014';
    if (typeof formatRunTime === 'function') return formatRunTime(ms);
    return String(ms);
}
function estimateSqlRepeatDrilldownExtraHeight(d) {
    if (!d) return 0;
    var sqlChars = (d.sqlSnippet && d.sqlSnippet.length) || 0;
    var sqlLines = Math.ceil(Math.min(sqlChars, SQL_REPEAT_SNIPPET_STORE_CAP) / 68);
    sqlLines = Math.max(1, Math.min(sqlLines, 6));
    var v = d.variants ? d.variants.length : 0;
    var more = d.moreVariantCount > 0 ? 1 : 0;
    var staticRow = (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled && d.fingerprint) ? 28 : 0;
    return 44 + sqlLines * 16 + v * 18 + more * 16 + staticRow;
}
/** Build repeat-notification inner HTML for SQL fingerprint rows (collapsed or expanded). */
function buildSqlRepeatNotificationRowHtml(item) {
    var d = item.sqlRepeatDrilldown;
    var expanded = !!item.sqlRepeatDrilldownOpen;
    var preview = escapeHtml(item.repeatPreviewText || '\\u2026');
    var cnt = d ? d.repeatCount : 0;
    var label = cnt + ' × SQL repeated:';
    var seq = item.seq;
    var ariaExp = expanded ? 'true' : 'false';
    var head = '<span class="repeat-notification repeat-sql-fp">' +
        '<button type="button" class="sql-repeat-drilldown-toggle" data-seq="' + seq + '" aria-expanded="' + ariaExp + '" aria-label="SQL repeat details: ' + escapeHtml(label) + '">' +
        escapeHtml(label) + '</button>' +
        ' <span class="repeat-preview">' + preview + '</span>';
    if (!expanded || !d) {
        return head + '</span>';
    }
    var fpDisp = escapeHtml(d.fingerprint || '');
    var t0 = formatSqlRepeatDrilldownTs(d.firstTs);
    var t1 = formatSqlRepeatDrilldownTs(d.lastTs);
    var sqlEsc = escapeHtml(d.sqlSnippet || '');
    var detail = '<div class="sql-repeat-drilldown-detail" role="region" aria-label="SQL repeat samples" tabindex="-1">' +
        '<div class="sql-repeat-drilldown-meta"><span class="sql-repeat-drilldown-meta-label">Fingerprint</span> <code class="sql-repeat-drilldown-fp">' + fpDisp + '</code></div>' +
        '<div class="sql-repeat-drilldown-meta">' + escapeHtml('Time') + ': ' + escapeHtml(t0) + ' \\u2013 ' + escapeHtml(t1) + '</div>' +
        '<pre class="sql-repeat-drilldown-snippet">' + sqlEsc + '</pre>' +
        '<div class="sql-repeat-drilldown-variant-title">' + escapeHtml('Argument variants (first-seen order, capped)') + '</div>';
    var vi;
    for (vi = 0; vi < (d.variants || []).length; vi++) {
        var vr = d.variants[vi];
        detail += '<div class="sql-repeat-drilldown-variant"><span class="sql-repeat-drilldown-variant-count">×' + (vr.count | 0) + '</span> <code>' + escapeHtml(vr.argsKey || '') + '</code></div>';
    }
    if (d.moreVariantCount > 0) {
        detail += '<div class="sql-repeat-drilldown-more">' + escapeHtml('+' + d.moreVariantCount + ' more distinct arg variant(s)') + '</div>';
    }
    if (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled && d.fingerprint) {
        detail += '<div class="sql-repeat-drilldown-actions"><button type="button" class="sql-repeat-static-sources" data-fingerprint="' + escapeHtml(d.fingerprint) + '">Possible Dart sources (static index, not stack)</button></div>';
    }
    detail += '</div>';
    return '<span class="repeat-notification repeat-sql-fp repeat-sql-fp-expanded">' +
        '<button type="button" class="sql-repeat-drilldown-toggle" data-seq="' + seq + '" aria-expanded="true" aria-label="SQL repeat details: ' + escapeHtml(label) + '">' +
        escapeHtml(label) + '</button>' +
        ' <span class="repeat-preview">' + preview + '</span></span>' + detail;
}
function toggleSqlRepeatDrilldown(seq) {
    var idx;
    for (idx = 0; idx < allLines.length; idx++) {
        var it = allLines[idx];
        if (it && it.type === 'repeat-notification' && it.seq === seq && it.sqlRepeatDrilldown) {
            it.sqlRepeatDrilldownOpen = !it.sqlRepeatDrilldownOpen;
            it.html = buildSqlRepeatNotificationRowHtml(it);
            if (typeof recalcHeights === 'function') recalcHeights();
            if (typeof renderViewport === 'function') renderViewport(true);
            return;
        }
    }
}
/**
 * Separator / banner detection for .separator-line CSS. Must match
 * isLogViewerSeparatorLine in modules/analysis/log-viewer-separator-line.ts (unit-tested there).
 */
function isAsciiBoxDrawingDecorLine(plain) {
    return /^\\s*\\u2502\\s+(?:.*\\S\\s*)?\\u2502\\s*$/.test(plain);
}
function isSeparatorLine(plainText) {
    if (isAsciiBoxDrawingDecorLine(plainText)) return true;
    var trimmed = plainText.trim();
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
