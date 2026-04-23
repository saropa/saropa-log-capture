/**
 * Repeat-collapse branch for addToData, extracted to keep the file under the line limit.
 *
 * Only SQL fingerprint repeats reach this function. Non-SQL repeats are always
 * stored individually in allLines (the compress dedup algorithm handles grouping
 * when the user toggles compress mode on).
 *
 * **SQL fingerprint repeats:** the anchor is hidden and a single `repeat-notification` row
 * with drilldown is created/updated in place.
 */

/** Get the embedded JavaScript for the repeat-collapse branch of addToData. */
export function getRepeatCollapseBranchScript(): string {
    return /* javascript */ `
function handleRepeatCollapse(category, ts, fw, sp, elapsedMs, source, rawText, tier, lvl, sTag, lTag, cTags, sqlMeta, catFiltered, plain, minN) {
    var lineSource = source || 'debug';
    /* Mirror addToData tier resolution (keep these two in sync). Unclassified DAP stdout/stderr/console
       lines fall back to 'flutter' so the Flutter DAP radio can hide them — see addToData for the full
       rationale (bug: toggling Log Sources options had no effect because plain print() output was
       tier=undefined and bypassed isTierHidden()). */
    var lineTier = tier || (fw === true ? 'device-other' : (fw === false ? 'flutter' : (lineSource !== 'debug' ? 'external' : 'flutter')));
    if (typeof breakContinuationGroup === 'function') breakContinuationGroup();

    /* --- SQL fingerprint repeats: notification row with drilldown --- */

    // First line that enters repeat-collapse: hide the anchor row; further repeats update one notification row.
    /* collapsedAnchorText/RawText carry the hidden anchor's content forward onto the
       notification row so Ctrl+C can expand "N × SQL repeated" back into N real lines
       on copy. Captured here (at hide time) because the anchor is the only place the
       full original text lives — sqlRepeatDrilldown.sqlSnippet is capped at 500 chars
       and sqlHistoryPreview at 120, neither is safe for round-tripping the raw SQL. */
    var collapsedAnchorText = '';
    var collapsedAnchorRawText = null;
    if (repeatTracker.count === minN && repeatTracker.lastLineIndex >= 0 &&
        repeatTracker.lastLineIndex < allLines.length) {
        var sqlOrigItem = allLines[repeatTracker.lastLineIndex];
        if (sqlOrigItem && sqlOrigItem.height > 0) {
            totalHeight -= sqlOrigItem.height;
            sqlOrigItem.height = 0;
            sqlOrigItem.repeatHidden = true;
            collapsedAnchorText = (typeof stripTags === 'function') ? stripTags(sqlOrigItem.html || '') : String(sqlOrigItem.html || '');
            collapsedAnchorRawText = sqlOrigItem.rawText || null;
        }
    }

    var preview = repeatTracker.sqlRepeatPreview || (repeatTracker.lastPlainText || '').substring(0, repeatPreviewLength);
    if (!repeatTracker.sqlRepeatPreview && repeatTracker.lastPlainText && repeatTracker.lastPlainText.length > repeatPreviewLength) {
        preview += '...';
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
    var sqlDrill = (typeof snapshotSqlRepeatDrilldown === 'function') ? snapshotSqlRepeatDrilldown(ts) : null;
    var repeatHtml = (sqlDrill && typeof buildSqlRepeatNotificationRowHtml === 'function')
        ? buildSqlRepeatNotificationRowHtml({
            sqlRepeatDrilldown: sqlDrill,
            sqlRepeatDrilldownOpen: isUpdate && repeatItem ? !!repeatItem.sqlRepeatDrilldownOpen : false,
            repeatPreviewText: preview || '\\u2026',
            seq: repeatSeq
        })
        : '<span class="repeat-notification">' + repeatTracker.count + ' \\u00d7 SQL repeated: <span class="repeat-preview">' + escapeHtml(preview || '\\u2026') + '</span></span>';
    var repeatAutoHide = (typeof testAutoHide === 'function' && repeatTracker.lastPlainText) ? testAutoHide(repeatTracker.lastPlainText) : false;
    if (isUpdate && repeatItem) {
        var oldH = repeatItem.height;
        totalHeight -= oldH;
    }
    var repeatTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier }) : false;
    /* The "N × SQL repeated:" row carries the collapsed SELECT's level (typically 'database').
       Without this check it was visible even with the Database filter off — the user toggles
       the filter, but the notification row is built here during streaming and had no filter
       flag set until applyLevelFilter() ran on the next user interaction. */
    var repeatLvlFilt = (typeof calcLevelFiltered === 'function') ? calcLevelFiltered(lvl) : false;
    var repeatH = (repeatAutoHide || catFiltered || repeatTierHidden || repeatLvlFilt) ? 0 : ROW_HEIGHT;
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
            timeRangeFiltered: false,
            levelFiltered: repeatLvlFilt
        };
        if (sqlDrill) {
            repeatItem.sqlRepeatDrilldown = sqlDrill;
            repeatItem.sqlRepeatDrilldownOpen = false;
            repeatItem.repeatPreviewText = preview || '\\u2026';
        }
        /* Copy-expansion data (set only on initial creation — the anchor is in range
           only on this code path; subsequent repeats take the update branch below
           after the anchor has already been hidden). */
        if (collapsedAnchorText) repeatItem.collapsedLineText = collapsedAnchorText;
        if (collapsedAnchorRawText) repeatItem.collapsedRawText = collapsedAnchorRawText;
        /* DB_11: fingerprint + preview on repeat rows for query history rebuild after trim (no dbSignal on these rows). */
        if (sqlMeta && sqlMeta.fingerprint) {
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
        /* Keep levelFiltered in sync with the (possibly refreshed) level — calcItemHeight
           below reads it, so a stale flag would leak visibility or hide incorrectly. */
        repeatItem.levelFiltered = repeatLvlFilt;
        repeatItem.sourceTag = sTag;
        repeatItem.logcatTag = lTag;
        repeatItem.classTags = cTags;
        repeatItem.isAnr = (lvl === 'performance' && anrPattern.test(repeatTracker.lastPlainText));
        repeatItem.source = lineSource;
        if (sqlDrill) {
            repeatItem.sqlRepeatDrilldown = sqlDrill;
            repeatItem.repeatPreviewText = preview || '\\u2026';
        }
        if (sqlMeta && sqlMeta.fingerprint) {
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
