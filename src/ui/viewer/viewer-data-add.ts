/**
 * Script chunk for data insertion and stack-group toggling.
 *
 * **N+1 insight rows:** After a normal log line is appended, optional Drift SQL burst
 * detection may append a synthetic `n-plus-one-insight` row. That path is wrapped in
 * try/catch so malformed log text cannot break streaming ingest.
 */
export function getViewerDataAddScript(): string {
    return /* javascript */ `
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
        var hdr = { html: html, type: 'stack-header', height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: 'preview', previewCount: 3, timestamp: ts, fw: fw, level: 'error', seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false, autoHidden: hdrAutoHide, qualityPercent: qualityPercent, source: lineSource };
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

    // Real-time repeat detection (Drift DB lines: fingerprint hash + verb-specific collapse threshold).
    var sqlMetaRepeat = (sTag === 'database' && typeof parseSqlFingerprint === 'function') ? parseSqlFingerprint(plain) : null;
    // Level in the key avoids merging repeats across severity changes for the same fingerprint.
    var currentHash = (sqlMetaRepeat && sqlMetaRepeat.fingerprint)
        ? (lvl + '::dbfp::' + sqlMetaRepeat.fingerprint)
        : generateRepeatHash(lvl, plain);
    var lineThresholdN = (typeof getDriftRepeatMinN === 'function') ? getDriftRepeatMinN(sqlMetaRepeat, sTag) : 2;
    var now = ts || Date.now();
    var inRepeatWindow = currentHash !== null && repeatTracker.lastHash === currentHash &&
        (now - repeatTracker.lastTimestamp) < repeatWindowMs;

    if (inRepeatWindow) {
        repeatTracker.count++;
        repeatTracker.lastTimestamp = now;
    } else {
        repeatTracker.lastHash = currentHash;
        repeatTracker.lastPlainText = plain;
        repeatTracker.lastLevel = lvl;
        repeatTracker.count = 1;
        repeatTracker.lastTimestamp = now;
        repeatTracker.streakMinN = lineThresholdN;
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

        var preview = (repeatTracker.lastPlainText || '').substring(0, repeatPreviewLength);
        if (repeatTracker.lastPlainText && repeatTracker.lastPlainText.length > repeatPreviewLength) {
            preview += '...';
        }
        var repeatHtml = '<span class="repeat-notification">' +
            'Repeated #' + repeatTracker.count +
            ' <span class="repeat-preview">(' + escapeHtml(preview || '\\u2026') + ')</span></span>';
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
            seq: nextSeq++,
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
            source: lineSource
        };
        allLines.push(repeatItem);
        resetCompressDupStreak();
        if (typeof registerSourceTag === 'function') { registerSourceTag(repeatItem); }
        if (typeof registerClassTags === 'function') { registerClassTags(repeatItem); }
        if (typeof registerSqlPattern === 'function') { registerSqlPattern(repeatItem); }
        totalHeight += repeatH;
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
        var lineItem = { html: html, type: 'line', height: finalH, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, logcatTag: lTag, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: !!classHidden, classTags: cTags, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed, fw: fw, sourcePath: sp || null, scopeFiltered: scopeFilt, isAnr: isAnr, autoHidden: isAutoHidden, source: lineSource };
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

        // One parse per line: shared by dbInsight rollup and N+1 detector (Drift SQL only).
        var sqlMetaLine = (typeof parseSqlFingerprint === 'function') ? parseSqlFingerprint(plain) : null;

        if (sTag === 'database') {
            var rollupDb = (sqlMetaLine && typeof updateDbInsightRollup === 'function')
                ? updateDbInsightRollup(sqlMetaLine.fingerprint, lineItem.elapsedMs)
                : null;
            var snipDb = sqlMetaLine && sqlMetaLine.sqlSnippet ? sqlMetaLine.sqlSnippet : null;
            if (!snipDb) {
                var di = plain.indexOf('Drift:');
                var rawSnip = di >= 0 ? plain.substring(di).trim() : plain.trim();
                snipDb = rawSnip.length > 500 ? rawSnip.substring(0, 497) + '...' : rawSnip;
            }
            lineItem.dbInsight = {
                fingerprint: sqlMetaLine ? sqlMetaLine.fingerprint : null,
                sqlSnippet: snipDb,
                seenCount: rollupDb ? rollupDb.seenCount : 1,
                avgDurationMs: rollupDb ? rollupDb.avgDurationMs : undefined,
                maxDurationMs: rollupDb ? rollupDb.maxDurationMs : undefined
            };
        }

        // N+1 detector: bursts of the same Drift SQL fingerprint with varying args (must not throw).
        try {
            if (sqlMetaLine && typeof detectNPlusOneInsight === 'function') {
                var insight = detectNPlusOneInsight(now, sqlMetaLine.fingerprint, sqlMetaLine.argsKey);
                if (insight) {
                    var windowSec = (insight.windowSpanMs / 1000).toFixed(2);
                    var confLabel = insight.confidence.toUpperCase();
                    var previewFingerprint = sqlMetaLine.fingerprint.length > 96
                        ? sqlMetaLine.fingerprint.substring(0, 96) + '...'
                        : sqlMetaLine.fingerprint;
                    var n1Html = '<span class="repeat-notification n1-insight">'
                        + '\\u26a0 Potential N+1 query '
                        + '<span class="n1-conf n1-conf-' + insight.confidence + '">[' + confLabel + ']</span> '
                        + ' - ' + insight.repeats + ' repeats / ' + insight.distinctArgs + ' arg variants in ' + windowSec + 's'
                        + ' <span class="n1-fp">(' + escapeHtml(previewFingerprint) + ')</span>'
                        + ' <span class="n1-actions">'
                        + '<span class="n1-action" data-action="focus-db" title="Show only database-tagged lines">Focus DB</span>'
                        + ' · '
                        + '<span class="n1-action" data-action="focus-fingerprint" data-fingerprint="' + escapeHtml(sqlMetaLine.fingerprint) + '" title="Search this SQL fingerprint">Find fingerprint</span>'
                        + '</span>'
                        + '</span>';
                    var n1Item = {
                        html: n1Html,
                        type: 'n-plus-one-insight',
                        height: ROW_HEIGHT,
                        category: 'db-insight',
                        groupId: -1,
                        timestamp: ts,
                        level: 'performance',
                        seq: nextSeq++,
                        sourceTag: 'database',
                        logcatTag: null,
                        sourceFiltered: false,
                        sqlPatternFiltered: false,
                        classFiltered: false,
                        classTags: [],
                        isSeparator: false,
                        sourcePath: sp || null,
                        scopeFiltered: scopeFilt,
                        autoHidden: false,
                        source: lineSource
                    };
                    allLines.push(n1Item);
                    if (typeof registerSourceTag === 'function') { registerSourceTag(n1Item); }
                    if (typeof registerSqlPattern === 'function') { registerSqlPattern(n1Item); }
                    totalHeight += ROW_HEIGHT;
                    resetCompressDupStreak();
                }
            }
        } catch (_n1Err) { /* swallow — never block ingest on heuristic */ }

        if (typeof registerSqlPattern === 'function') { registerSqlPattern(lineItem); }
    }
}

function toggleStackGroup(groupId) {
    var header = groupHeaderMap[groupId];
    if (!header) return;
    // Cycle: preview -> expanded -> collapsed -> preview
    if (header.collapsed === 'preview') {
        header.collapsed = false; // Expand all
    } else if (header.collapsed === false) {
        header.collapsed = true; // Collapse all
    } else {
        header.collapsed = 'preview'; // Show preview
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}
`;
}
