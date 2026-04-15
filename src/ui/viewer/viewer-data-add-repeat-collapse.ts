/**
 * Repeat-collapse branch for addToData: when the streak exceeds minN, the anchor row
 * is hidden and a single `repeat-notification` row is created/updated in place.
 * Extracted from viewer-data-add.ts to keep the file under the line limit.
 */

/** Get the embedded JavaScript for the repeat-collapse branch of addToData. */
export function getRepeatCollapseBranchScript(): string {
    return /* javascript */ `
function handleRepeatCollapse(category, ts, fw, sp, elapsedMs, source, rawText, tier, lvl, sTag, lTag, cTags, sqlMeta, catFiltered, plain, minN) {
    var lineSource = source || 'debug';
    /* Mirror addToData: non-debug-console sources get 'external' tier. */
    var lineTier = tier || (fw === true ? 'device-other' : (fw === false ? 'flutter' : (lineSource !== 'debug' ? 'external' : undefined)));
    if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
    // First line that enters repeat-collapse: hide the anchor row; further repeats update one notification row.
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
    var isUpdate = repeatTracker.count > minN && repeatTracker.lastRepeatNotificationIndex >= 0
        && repeatTracker.lastRepeatNotificationIndex < allLines.length;
    var repeatItem = isUpdate ? allLines[repeatTracker.lastRepeatNotificationIndex] : null;
    if (isUpdate && (!repeatItem || repeatItem.type !== 'repeat-notification')) {
        isUpdate = false;
        repeatTracker.lastRepeatNotificationIndex = -1;
        repeatItem = null;
    }
    var repeatSeq = isUpdate && repeatItem ? repeatItem.seq : nextSeq++;
    var repeatHtml;
    var sqlDrill = null;
    if (repeatTracker.streakSqlFp && typeof snapshotSqlRepeatDrilldown === 'function' && typeof buildSqlRepeatNotificationRowHtml === 'function') {
        sqlDrill = snapshotSqlRepeatDrilldown(ts);
        repeatHtml = buildSqlRepeatNotificationRowHtml({
            sqlRepeatDrilldown: sqlDrill,
            sqlRepeatDrilldownOpen: isUpdate && repeatItem ? !!repeatItem.sqlRepeatDrilldownOpen : false,
            repeatPreviewText: preview || '\\u2026',
            seq: repeatSeq
        });
    } else {
        var countLabel = repeatTracker.count + ' \\u00d7 Repeated:';
        repeatHtml = '<span class="repeat-notification">' +
            countLabel +
            ' <span class="repeat-preview">' + escapeHtml(preview || '\\u2026') + '</span></span>';
    }
    var repeatAutoHide = (typeof testAutoHide === 'function' && repeatTracker.lastPlainText) ? testAutoHide(repeatTracker.lastPlainText) : false;
    if (isUpdate && repeatItem) {
        var oldH = repeatItem.height;
        totalHeight -= oldH;
    }
    var repeatTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier }) : false;
    var repeatH = (repeatAutoHide || catFiltered || repeatTierHidden) ? 0 : ROW_HEIGHT;
    if (!isUpdate && repeatAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
    if (!isUpdate) {
        repeatItem = {
            html: repeatHtml,
            rawText: null,
            type: 'repeat-notification',
            height: repeatH,
            category: category,
            groupId: -1,
            timestamp: ts,
            level: lvl,
            seq: repeatSeq,
            sourceTag: sTag,
            logcatTag: lTag,
            sqlVerb: sqlMeta ? sqlMeta.verb : null,
            tier: lineTier,
            filteredOut: catFiltered,
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
        /* DB_11: fingerprint + preview on repeat rows for query history rebuild after trim (no dbSignal on these rows). */
        if (repeatTracker.streakSqlFp && sqlMeta && sqlMeta.fingerprint) {
            repeatItem.sqlHistoryFp = sqlMeta.fingerprint;
            var histPvwNew = (sqlMeta.sqlSnippet || repeatTracker.sqlStreakSqlSnippet || '').trim();
            repeatItem.sqlHistoryPreview = histPvwNew.length > 120 ? histPvwNew.substring(0, 117) + '...' : histPvwNew;
        }
        allLines.push(repeatItem);
        repeatTracker.lastRepeatNotificationIndex = allLines.length - 1;
    } else if (repeatItem) {
        repeatItem.html = repeatHtml;
        repeatItem.timestamp = ts;
        repeatItem.level = lvl;
        repeatItem.sourceTag = sTag;
        repeatItem.logcatTag = lTag;
        repeatItem.classTags = cTags;
        repeatItem.isAnr = (lvl === 'performance' && anrPattern.test(repeatTracker.lastPlainText));
        repeatItem.source = lineSource;
        if (sqlDrill) {
            repeatItem.sqlRepeatDrilldown = sqlDrill;
            repeatItem.repeatPreviewText = preview || '\\u2026';
        }
        if (repeatTracker.streakSqlFp && sqlMeta && sqlMeta.fingerprint) {
            repeatItem.sqlHistoryFp = sqlMeta.fingerprint;
            var histPvwUp = (sqlMeta.sqlSnippet || repeatTracker.sqlStreakSqlSnippet || '').trim();
            repeatItem.sqlHistoryPreview = histPvwUp.length > 120 ? histPvwUp.substring(0, 117) + '...' : histPvwUp;
        }
        repeatH = (typeof calcItemHeight === 'function') ? calcItemHeight(repeatItem) : (repeatAutoHide ? 0 : ROW_HEIGHT);
        repeatItem.height = repeatH;
    }
    resetCompressDupStreak();
    if (!isUpdate) {
        if (typeof registerSourceTag === 'function') { registerSourceTag(repeatItem); }
        if (typeof registerClassTags === 'function') { registerClassTags(repeatItem); }
        if (typeof registerSqlPattern === 'function') { registerSqlPattern(repeatItem); }
    }
    if (typeof recordSqlQueryHistoryForAppendedItem === 'function') { recordSqlQueryHistoryForAppendedItem(repeatItem); }
    totalHeight += repeatH;

    // Collapsed repeats skip the normal-line branch; still feed session rollup and N+1 detector (per-line args).
    var scopeFiltCol = (typeof calcScopeFiltered === 'function') ? calcScopeFiltered(sp) : false;
    emitDbLineDetectors(ts || Date.now(), sqlMeta, 'database', scopeFiltCol, ts, sp, lineSource, lvl, elapsedMs, repeatTracker.lastPlainText || '', repeatItem.seq, null);
}
`;
}
