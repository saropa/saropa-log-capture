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
import { getRepeatCollapseBranchScript } from './viewer-data-add-repeat-collapse';
import { getAsciiArtDetectScript } from './viewer-data-add-ascii-art-detect';

export function getViewerDataAddScript(staticSqlFromFingerprintEnabled = true): string {
    return getDriftDebugServerFromLogScript() + getViewerDataAddDbDetectorsScript(staticSqlFromFingerprintEnabled) + getContinuationScript() + getRepeatCollapseBranchScript() + getAsciiArtDetectScript() + /* javascript */ `

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

/** Level of the most recent non-marker line, for stack-header inheritance. */
function previousLineLevel() {
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        if (it.type === 'marker' || it.type === 'run-separator') return 'error';
        if (it.level) return it.level;
    }
    return 'error';
}

function addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier) {
    /* elapsedMs: per-line delay (from [+Nms]) for replay. qualityPercent: per-file line coverage (0-100) for badges. source: stream id for multi-source filter ('debug'|'terminal'|...). tier: 'flutter'|'device-critical'|'device-other' */
    var lineSource = source || 'debug';
    var lineTier = tier || (fw === true ? 'device-other' : (fw === false ? 'flutter' : undefined));
    /* Category filter: lines arriving while a category is unchecked must start hidden. */
    var catFiltered = !!(typeof activeFilters !== 'undefined' && activeFilters && !isMarker && !activeFilters.has(category));
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
        if (typeof finalizeArtBlock === 'function') finalizeArtBlock();
        var markerItem = { html: html, rawText: rawText || null, type: 'marker', height: MARKER_HEIGHT, category: category, groupId: -1, timestamp: ts, sourcePath: sp || null, source: lineSource };
        if (elapsedMs !== undefined && elapsedMs >= 0) markerItem.elapsedMs = elapsedMs;
        allLines.push(markerItem);
        totalHeight += MARKER_HEIGHT;
        return;
    }
    if (isStackFrameText(html)) {
        resetCompressDupStreak();
        if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
        if (typeof finalizeArtBlock === 'function') finalizeArtBlock();
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
            var sfItem = { html: html, rawText: rawText || null, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, tier: lineTier, level: activeGroupHeader.level, sourceTag: activeGroupHeader.sourceTag, logcatTag: activeGroupHeader.logcatTag, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsF, context: context, _appFrameIdx: appIdx, sourcePath: sp || null, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource };
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
        var hdrTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier }) : false;
        var hdrH = (hdrAutoHide || catFiltered || hdrTierHidden) ? 0 : ROW_HEIGHT;
        if (hdrAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        // Use configurable defaults: stackDefaultState (false/true/'preview'), stackPreviewCount (1-20).
        var _sds = (typeof stackDefaultState !== 'undefined') ? stackDefaultState : false;
        var _spc = (typeof stackPreviewCount !== 'undefined') ? stackPreviewCount : 3;
        var hdr = { html: html, rawText: rawText || null, type: 'stack-header', height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: _sds, previewCount: _spc, timestamp: ts, fw: fw, tier: lineTier, level: previousLineLevel(), seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false, autoHidden: hdrAutoHide, qualityPercent: qualityPercent, source: lineSource };
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
    var lvl = isSep ? 'info' : isAi ? 'notice' : ((typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info');
    /* Device-other: demote error/warning to info so device noise never shows red/yellow. Device-critical keeps its real severity. */
    if (lineTier === 'device-other' && (lvl === 'error' || lvl === 'warning')) lvl = 'info';
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
    // Source-tag driven: any line tagged 'database' that isn't already error/warning gets the level.
    // Separator lines stay 'info' — source tags should not override decorative lines.
    if (!isSep && sTag === 'database' && lvl !== 'error' && lvl !== 'warning' && lvl !== 'database') { lvl = 'database'; }
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
        handleRepeatCollapse(category, ts, fw, sp, elapsedMs, source, rawText, tier, lvl, sTag, lTag, cTags, sqlMeta, catFiltered, plain, minN);
    } else {

        // Add the original line normally (includes first line of a streak and lines before threshold N).
        var errorClass = (typeof classifyError === 'function' && lineTier !== 'device-other' && (!strictLevelDetection || lvl === 'error')) ? classifyError(plain) : null;
        var errorSuppressed = (typeof suppressTransientErrors !== 'undefined' && suppressTransientErrors && errorClass === 'transient');

        // Check for critical errors (skip device-other — system noise should never trigger notifications)
        if (typeof checkCriticalError === 'function' && lineTier !== 'device-other') {
            checkCriticalError(plain);
        }

        var lineTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier }) : false;
        var classHidden = (typeof isClassFiltered === 'function' && isClassFiltered({ classTags: cTags, type: 'line' }));
        var isAutoHidden = (typeof testAutoHide === 'function') ? testAutoHide(plain) : false;
        var lineH = (errorSuppressed || lineTierHidden || classHidden || catFiltered) ? 0 : ROW_HEIGHT;
        var scopeFilt = (typeof calcScopeFiltered === 'function') ? calcScopeFiltered(sp) : false;
        var finalH = (scopeFilt || isAutoHidden) ? 0 : lineH;
        if (isAutoHidden && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        var isAnr = (lvl === 'performance' && anrPattern.test(plain));
        var lineItem = { html: html, rawText: rawText || null, type: 'line', height: finalH, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, logcatTag: lTag, sqlVerb: sqlMeta ? sqlMeta.verb : null, tier: lineTier, filteredOut: catFiltered, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: !!classHidden, classTags: cTags, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed, fw: fw, sourcePath: sp || null, scopeFiltered: scopeFilt, isAnr: isAnr, autoHidden: isAutoHidden, source: lineSource, timeRangeFiltered: false, recentErrorContext: recentErrorContext };
        if (elapsedMs !== undefined && elapsedMs >= 0) lineItem.elapsedMs = elapsedMs;
        allLines.push(lineItem);
        /* Art-block grouping: consecutive separator lines within 1 s form one visual block.
           Each DAP output event creates a new Date() so lines in the same banner differ by milliseconds. */
        if (viewerGroupAsciiArt && isSep && ts) {
            if (artBlockTracker.count > 0 && Math.abs(ts - artBlockTracker.timestamp) < 1000) {
                artBlockTracker.count++;
                artBlockTracker.timestamp = ts;
            } else {
                if (typeof finalizeArtBlock === 'function') finalizeArtBlock();
                artBlockTracker.startIdx = allLines.length - 1;
                artBlockTracker.timestamp = ts;
                artBlockTracker.count = 1;
            }
        } else if (artBlockTracker.count > 0) {
            if (typeof finalizeArtBlock === 'function') finalizeArtBlock();
        }
        /* Generalized ASCII art detection (plan 046): score non-separator lines via entropy heuristics. */
        if (!isSep && typeof feedAsciiArtDetector === 'function') {
            feedAsciiArtDetector(plain, allLines.length - 1, ts);
        }
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
