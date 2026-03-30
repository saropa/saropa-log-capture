/**
 * Script chunk for data insertion and stack-group toggling.
 *
 * **Drift SQL:** `parseSqlFingerprint(plain)` runs **once** per normal log line; the result
 * drives repeat keys (for `database`-tagged lines), `emitDbLineDetectors` (DB_15: primary
 * `session-rollup-patch`, slow-burst markers, N+1, `annotate-line`). Session rollup and
 * `lineItem.dbInsight` are applied inside `emitDbLineDetectors`. Repeat-collapse and full-line
 * ingest both call `emitDbLineDetectors` so arg-variant bursts still register when rows
 * fold into `repeat-notification`. Synthetic rows are built in `viewer-data-add-db-detectors.ts`.
 *
 * **Repeat UI:** After the collapse threshold, the streak uses **one** `repeat-notification` row
 * (`repeatTracker.lastRepeatNotificationIndex`) updated in place with **N × Repeated:** / **N × SQL repeated:**
 * so long runs do not spam one line per duplicate.
 */
import { getContinuationScript } from './viewer-data-add-continuation';
import { getViewerDataAddDbDetectorsScript } from './viewer-data-add-db-detectors';
import { getViewerDataAddStackGroupLearningAndToggleScript } from './viewer-data-add-stack-group-learning-and-toggle';
import { getDriftDebugServerFromLogScript } from './viewer-drift-debug-server-from-log-script';

export function getViewerDataAddScript(staticSqlFromFingerprintEnabled = true): string {
    return getDriftDebugServerFromLogScript() + getViewerDataAddDbDetectorsScript(staticSqlFromFingerprintEnabled) + getContinuationScript() + /* javascript */ `

/** Nearest earlier line used for the “recent error context” window (skips Drift SQL rows). */
function proximityInheritAnchor() {
    var j = allLines.length - 1;
    while (j >= 0) {
        var it = allLines[j];
        if (it.type === 'marker' || it.type === 'run-separator') { return null; }
        var p = stripTags(it.html);
        if (typeof isDriftSqlStatementLine === 'function' && isDriftSqlStatementLine(p)) {
            j--;
            continue;
        }
        return it;
    }
    return null;
}

function addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source) {
    /* elapsedMs: per-line delay (from [+Nms]) for replay. qualityPercent: per-file line coverage (0-100) for badges. source: stream id for multi-source filter ('debug'|'terminal'|...). */
    var lineSource = source || 'debug';
    if (ts && !sessionStartTs) sessionStartTs = ts;
    if (isMarker) {
        resetCompressDupStreak();
        if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
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
        if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
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
        // Expanded by default so every frame is visible; users can click the header to collapse or use preview.
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
    if (typeof ingestDriftDebugServerFromPlain === 'function') ingestDriftDebugServerFromPlain(plain);
    var isSep = isSeparatorLine(plain);
    var isAi = category && category.indexOf('ai-') === 0;
    var lvl = isAi ? 'notice' : ((typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info');
    // Recent-error context: if this line is plain info but falls inside 2s after a real error/stack line
    // above (see Level Filters fly-up), it is tinted like an error so the incident reads as one band.
    // Those rows are flagged recentErrorContext and styled distinctly from the faulting line. Drift SQL
    // never gets this tint and is skipped when locating the prior error so it does not break the band.
    var skipProximityInherit = (typeof isDriftSqlStatementLine === 'function' && isDriftSqlStatementLine(plain));
    var recentErrorContext = false;
    if (lvl === 'info' && !isSep && !skipProximityInherit && typeof proximityInheritAnchor === 'function') {
        var anchor = proximityInheritAnchor();
        if (anchor && anchor.level === 'error' && ts && anchor.timestamp
            && Math.abs(ts - anchor.timestamp) <= 2000) {
            lvl = 'error';
            recentErrorContext = true;
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
    // Separator / box-art lines are visual structure — never collapse them as repeats.
    var currentHash = isSep ? null
        : (sTag === 'database' && sqlMeta && sqlMeta.fingerprint)
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
        repeatTracker.lastRepeatNotificationIndex = -1;
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
        var repeatH = repeatAutoHide ? 0 : ROW_HEIGHT;
        if (!isUpdate && repeatAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        if (!isUpdate) {
            repeatItem = {
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
                sqlVerb: sqlMeta ? sqlMeta.verb : null,
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
        var lineItem = { html: html, type: 'line', height: finalH, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, logcatTag: lTag, sqlVerb: sqlMeta ? sqlMeta.verb : null, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: !!classHidden, classTags: cTags, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed, fw: fw, sourcePath: sp || null, scopeFiltered: scopeFilt, isAnr: isAnr, autoHidden: isAutoHidden, source: lineSource, timeRangeFiltered: false, recentErrorContext: recentErrorContext };
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
        if (typeof checkContinuationOnNormalLine === 'function') { checkContinuationOnNormalLine(lineItem); }
    }
}

${getViewerDataAddStackGroupLearningAndToggleScript()}
`;
}
