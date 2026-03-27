"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerDataAddScript = getViewerDataAddScript;
/**
 * Script chunk for data insertion and stack-group toggling.
 *
 * **Drift SQL:** `parseSqlFingerprint(plain)` runs **once** per normal log line; the result
 * drives repeat keys (for `database`-tagged lines), `emitDbLineDetectors` (DB_15: primary
 * `session-rollup-patch`, slow-burst markers, N+1, `annotate-line`). Session rollup and
 * `lineItem.dbInsight` are applied inside `emitDbLineDetectors`. Repeat-collapse and full-line
 * ingest both call `emitDbLineDetectors` so arg-variant bursts still register when rows
 * fold into `repeat-notification`. Synthetic rows are built in `viewer-data-add-db-detectors.ts`.
 */
const viewer_data_add_db_detectors_1 = require("./viewer-data-add-db-detectors");
const viewer_data_add_stack_group_learning_and_toggle_1 = require("./viewer-data-add-stack-group-learning-and-toggle");
function getViewerDataAddScript(staticSqlFromFingerprintEnabled = true) {
    return (0, viewer_data_add_db_detectors_1.getViewerDataAddDbDetectorsScript)(staticSqlFromFingerprintEnabled) + /* javascript */ `

function addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source) {
    /* elapsedMs: per-line delay (from [+Nms]) for replay. qualityPercent: per-file line coverage (0-100) for badges. source: stream id for multi-source filter ('debug'|'terminal'|...). */
    var lineSource = source || 'debug';
    if (ts && !sessionStartTs) sessionStartTs = ts;
    if (isMarker) {
        resetCompressDupStreak();
        if (activeGroupHeader) {
            if (typeof finalizeStackGroup === 'function') finalizeStackGroup(activeGroupHeader);
            if (typeof registerClassTags === 'function') registerClassTags(activeGroupHeader);
            activeGroupHeader = null;
        }
        cleanupTrailingRepeats();
        var markerItem = { html: html, type: 'marker', height: MARKER_HEIGHT, category: category, groupId: -1, timestamp: ts, sourcePath: sp || null, source: lineSource };
        if (elapsedMs !== undefined && elapsedMs >= 0) markerItem.elapsedMs = elapsedMs;
        allLines.push(markerItem);
        totalHeight += MARKER_HEIGHT;
        return;
    }
    if (isStackFrameText(html)) {
        resetCompressDupStreak();
        var plainFrame = stripTags(html);
        var context = (typeof extractContext === 'function') ? extractContext(plainFrame) : null;

        if (activeGroupHeader) {
            if (!activeGroupHeader._appFrameCount) activeGroupHeader._appFrameCount = 0;
            var appIdx = fw ? -1 : activeGroupHeader._appFrameCount;
            if (!fw) activeGroupHeader._appFrameCount++;
            var cTagsF = (typeof parseClassTags === 'function') ? parseClassTags(plainFrame) : [];
            if (cTagsF.length > 0 && activeGroupHeader.classTags) {
                for (var ci = 0; ci < cTagsF.length; ci++) {
                    if (activeGroupHeader.classTags.indexOf(cTagsF[ci]) < 0) activeGroupHeader.classTags.push(cTagsF[ci]);
                }
            }
            var sfItem = { html: html, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, level: 'error', sourceTag: activeGroupHeader.sourceTag, logcatTag: activeGroupHeader.logcatTag, sourceFiltered: false, classFiltered: false, classTags: cTagsF, context: context, _appFrameIdx: appIdx, sourcePath: sp || null, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource };
            if (elapsedMs !== undefined && elapsedMs >= 0) sfItem.elapsedMs = elapsedMs;
            allLines.push(sfItem);
            activeGroupHeader.frameCount++;
            return;
        }
        var gid = nextGroupId++;
        var sTagH = (typeof parseSourceTag === 'function') ? parseSourceTag(plainFrame) : null;
        var lTagH = (typeof parseLogcatTag === 'function') ? parseLogcatTag(plainFrame) : null;
        if (lTagH && lTagH === sTagH) lTagH = null;
        var cTagsH = (typeof parseClassTags === 'function') ? parseClassTags(plainFrame) : [];
        var hdrAutoHide = (typeof testAutoHide === 'function') ? testAutoHide(plainFrame) : false;
        var hdrH = hdrAutoHide ? 0 : ROW_HEIGHT;
        if (hdrAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        var hdr = { html: html, type: 'stack-header', height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: false, previewCount: 3, timestamp: ts, fw: fw, level: 'error', seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false, autoHidden: hdrAutoHide, qualityPercent: qualityPercent, source: lineSource };
        if (elapsedMs !== undefined && elapsedMs >= 0) hdr.elapsedMs = elapsedMs;
        allLines.push(hdr);
        if (typeof registerSourceTag === 'function') { registerSourceTag(hdr); }
        groupHeaderMap[gid] = hdr;
        activeGroupHeader = hdr;
        totalHeight += hdrH;
        return;
    }
    if (activeGroupHeader) {
        if (typeof finalizeStackGroup === 'function') finalizeStackGroup(activeGroupHeader);
        if (typeof registerClassTags === 'function') registerClassTags(activeGroupHeader);
        activeGroupHeader = null;
    }
    var plain = stripTags(html);
    var isSep = isSeparatorLine(plain);
    var isAi = category && category.indexOf('ai-') === 0;
    var lvl = isAi ? 'notice' : ((typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info');
    if (lvl === 'info' && !isSep && allLines.length > 0) {
        var prevItem = allLines[allLines.length - 1];
        if (prevItem && prevItem.type !== 'marker' && prevItem.type !== 'run-separator'
            && prevItem.level && prevItem.level !== 'info'
            && ts && prevItem.timestamp && Math.abs(ts - prevItem.timestamp) <= 2000) {
            lvl = prevItem.level;
        }
    }
    var sTag = (typeof parseSourceTag === 'function') ? parseSourceTag(plain) : null;
    var lTag = (typeof parseLogcatTag === 'function') ? parseLogcatTag(plain) : null;
    if (lTag && lTag === sTag) lTag = null;
    var cTags = (typeof parseClassTags === 'function') ? parseClassTags(plain) : [];

    // One parse per line: repeat tracker, dbInsight, and DB detectors share this object.
    var sqlMeta = (typeof parseSqlFingerprint === 'function') ? parseSqlFingerprint(plain) : null;

    // Real-time repeat detection (fingerprint key only for database-tagged Drift SQL).
    // Level in the key avoids merging repeats across severity changes for the same fingerprint.
    var currentHash = (sTag === 'database' && sqlMeta && sqlMeta.fingerprint)
        ? (lvl + '::sqlfp::' + sqlMeta.fingerprint)
        : generateRepeatHash(lvl, plain);
    var lineThresholdN = (typeof getDriftRepeatMinN === 'function') ? getDriftRepeatMinN(sqlMeta, sTag) : 2;
    var now = ts || Date.now();
    var inRepeatWindow = currentHash !== null && repeatTracker.lastHash === currentHash &&
        (now - repeatTracker.lastTimestamp) < repeatWindowMs;

    if (inRepeatWindow) {
        repeatTracker.count++;
        repeatTracker.lastTimestamp = now;
        if (repeatTracker.streakSqlFp) {
            repeatTracker.sqlStreakLastTs = now;
            if (sqlMeta) bumpSqlStreakVariant(sqlMeta.argsKey);
        }
    } else {
        repeatTracker.lastHash = currentHash;
        repeatTracker.lastPlainText = plain;
        repeatTracker.lastLevel = lvl;
        repeatTracker.count = 1;
        repeatTracker.lastTimestamp = now;
        repeatTracker.streakMinN = lineThresholdN;
        if (sTag === 'database' && sqlMeta && sqlMeta.fingerprint) {
            repeatTracker.streakSqlFp = true;
            var sn0 = sqlMeta.sqlSnippet || '';
            repeatTracker.sqlRepeatPreview = sn0.length > repeatPreviewLength ? sn0.substring(0, repeatPreviewLength) + '...' : sn0;
            repeatTracker.sqlStreakFingerprint = sqlMeta.fingerprint;
            repeatTracker.sqlStreakSqlSnippet = (typeof capSqlSnippetForDrilldown === 'function') ? capSqlSnippetForDrilldown(sn0) : sn0;
            repeatTracker.sqlStreakFirstTs = now;
            repeatTracker.sqlStreakLastTs = now;
            if (typeof resetSqlStreakVariantAccumulators === 'function') resetSqlStreakVariantAccumulators();
            if (typeof bumpSqlStreakVariant === 'function') bumpSqlStreakVariant(sqlMeta.argsKey);
        } else {
            repeatTracker.streakSqlFp = false;
            repeatTracker.sqlRepeatPreview = null;
            repeatTracker.sqlStreakFingerprint = null;
            repeatTracker.sqlStreakSqlSnippet = '';
            repeatTracker.sqlStreakFirstTs = 0;
            repeatTracker.sqlStreakLastTs = 0;
            repeatTracker.sqlStreakVariantOrder = [];
            repeatTracker.sqlStreakVariantCounts = null;
        }
    }

    var minN = repeatTracker.streakMinN;
    var shouldShowNormalLine = repeatTracker.count < minN;

    if (!shouldShowNormalLine) {
        // First line that enters repeat-collapse: hide the anchor row; further repeats only add notification rows.
        if (repeatTracker.count === minN && repeatTracker.lastLineIndex >= 0 &&
            repeatTracker.lastLineIndex < allLines.length) {
            var origItem = allLines[repeatTracker.lastLineIndex];
            if (origItem && origItem.height > 0) {
                totalHeight -= origItem.height;
                origItem.height = 0;
                origItem.repeatHidden = true;
            }
        }

        var preview;
        if (repeatTracker.streakSqlFp && repeatTracker.sqlRepeatPreview) {
            preview = repeatTracker.sqlRepeatPreview;
        } else {
            preview = (repeatTracker.lastPlainText || '').substring(0, repeatPreviewLength);
            if (repeatTracker.lastPlainText && repeatTracker.lastPlainText.length > repeatPreviewLength) {
                preview += '...';
            }
        }
        var repeatSeq = nextSeq++;
        var repeatHtml;
        var sqlDrill = null;
        if (repeatTracker.streakSqlFp && typeof snapshotSqlRepeatDrilldown === 'function' && typeof buildSqlRepeatNotificationRowHtml === 'function') {
            sqlDrill = snapshotSqlRepeatDrilldown(ts);
            repeatHtml = buildSqlRepeatNotificationRowHtml({
                sqlRepeatDrilldown: sqlDrill,
                sqlRepeatDrilldownOpen: false,
                repeatPreviewText: preview || '\\u2026',
                seq: repeatSeq
            });
        } else {
            var repeatLabelPlain = repeatTracker.streakSqlFp
                ? ('SQL repeated #' + repeatTracker.count)
                : ('Repeated #' + repeatTracker.count);
            repeatHtml = '<span class="repeat-notification' + (repeatTracker.streakSqlFp ? ' repeat-sql-fp' : '') + '">' +
                repeatLabelPlain +
                ' <span class="repeat-preview">(' + escapeHtml(preview || '\\u2026') + ')</span></span>';
        }
        var repeatAutoHide = (typeof testAutoHide === 'function' && repeatTracker.lastPlainText) ? testAutoHide(repeatTracker.lastPlainText) : false;
        var repeatH = repeatAutoHide ? 0 : ROW_HEIGHT;
        if (repeatAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        var repeatItem = {
            html: repeatHtml,
            type: 'repeat-notification',
            height: repeatH,
            category: category,
            groupId: -1,
            timestamp: ts,
            level: lvl,
            seq: repeatSeq,
            sourceTag: sTag,
            logcatTag: lTag,
            sourceFiltered: false,
            sqlPatternFiltered: false,
            classFiltered: false,
            classTags: cTags,
            isSeparator: false,
            sourcePath: sp || null,
            scopeFiltered: false,
            isAnr: (lvl === 'performance' && anrPattern.test(repeatTracker.lastPlainText)),
            autoHidden: repeatAutoHide,
            source: lineSource,
            timeRangeFiltered: false
        };
        if (sqlDrill) {
            repeatItem.sqlRepeatDrilldown = sqlDrill;
            repeatItem.sqlRepeatDrilldownOpen = false;
            repeatItem.repeatPreviewText = preview || '\\u2026';
        }
        /* DB_11: fingerprint + preview on repeat rows for query history rebuild after trim (no dbInsight on these rows). */
        if (repeatTracker.streakSqlFp && sqlMeta && sqlMeta.fingerprint) {
            repeatItem.sqlHistoryFp = sqlMeta.fingerprint;
            var histPvw = (sqlMeta.sqlSnippet || repeatTracker.sqlStreakSqlSnippet || '').trim();
            repeatItem.sqlHistoryPreview = histPvw.length > 120 ? histPvw.substring(0, 117) + '...' : histPvw;
        }
        allLines.push(repeatItem);
        resetCompressDupStreak();
        if (typeof registerSourceTag === 'function') { registerSourceTag(repeatItem); }
        if (typeof registerClassTags === 'function') { registerClassTags(repeatItem); }
        if (typeof registerSqlPattern === 'function') { registerSqlPattern(repeatItem); }
        if (typeof recordSqlQueryHistoryForAppendedItem === 'function') { recordSqlQueryHistoryForAppendedItem(repeatItem); }
        totalHeight += repeatH;

        // Collapsed repeats skip the normal-line branch; still feed session rollup and N+1 detector (per-line args).
        var scopeFiltCol = (typeof calcScopeFiltered === 'function') ? calcScopeFiltered(sp) : false;
        emitDbLineDetectors(now, sqlMeta, 'database', scopeFiltCol, ts, sp, lineSource, lvl, elapsedMs, repeatTracker.lastPlainText || '', repeatItem.seq, null);
    } else {

        // Add the original line normally (includes first line of a streak and lines before threshold N).
        var errorClass = (typeof classifyError === 'function' && (!strictLevelDetection || lvl === 'error')) ? classifyError(plain) : null;
        var errorSuppressed = (typeof suppressTransientErrors !== 'undefined' && suppressTransientErrors && errorClass === 'transient');

        // Check for critical errors
        if (typeof checkCriticalError === 'function') {
            checkCriticalError(plain);
        }

        var appHidden = (typeof appOnlyMode !== 'undefined' && appOnlyMode && fw);
        var classHidden = (typeof isClassFiltered === 'function' && isClassFiltered({ classTags: cTags, type: 'line' }));
        var isAutoHidden = (typeof testAutoHide === 'function') ? testAutoHide(plain) : false;
        var lineH = (errorSuppressed || appHidden || classHidden) ? 0 : ROW_HEIGHT;
        var scopeFilt = (typeof calcScopeFiltered === 'function') ? calcScopeFiltered(sp) : false;
        var finalH = (scopeFilt || isAutoHidden) ? 0 : lineH;
        if (isAutoHidden && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        var isAnr = (lvl === 'performance' && anrPattern.test(plain));
        var lineItem = { html: html, type: 'line', height: finalH, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, logcatTag: lTag, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: !!classHidden, classTags: cTags, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed, fw: fw, sourcePath: sp || null, scopeFiltered: scopeFilt, isAnr: isAnr, autoHidden: isAutoHidden, source: lineSource, timeRangeFiltered: false };
        if (elapsedMs !== undefined && elapsedMs >= 0) lineItem.elapsedMs = elapsedMs;
        allLines.push(lineItem);
        // Anchor the first visible line of this streak for hide-on-collapse (intermediate duplicates keep the same index).
        if (repeatTracker.count === 1) {
            repeatTracker.lastLineIndex = allLines.length - 1;
        }
        if (typeof registerSourceTag === 'function') { registerSourceTag(lineItem); }
        if (typeof registerClassTags === 'function') { registerClassTags(lineItem); }
        totalHeight += finalH;
        updateCompressDupStreakAfterLine(plain);

        emitDbLineDetectors(now, sqlMeta, sTag, scopeFilt, ts, sp, lineSource, lvl, lineItem.elapsedMs, plain, lineItem.seq, lineItem);

        if (typeof registerSqlPattern === 'function') { registerSqlPattern(lineItem); }
        if (typeof recordSqlQueryHistoryForAppendedItem === 'function') { recordSqlQueryHistoryForAppendedItem(lineItem); }
    }
}

${(0, viewer_data_add_stack_group_learning_and_toggle_1.getViewerDataAddStackGroupLearningAndToggleScript)()}
`;
}
//# sourceMappingURL=viewer-data-add.js.map