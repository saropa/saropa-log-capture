"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerDataAddScript = getViewerDataAddScript;
/**
 * Script chunk for data insertion and stack-group toggling.
 *
 * **Drift SQL:** `parseSqlFingerprint(plain)` runs **once** per normal log line; the result
 * drives repeat keys (for `database`-tagged lines), `emitDbLineDetectors` (DB_15: primary
 * `session-rollup-patch`, slow-burst markers, N+1, `annotate-line`). Session rollup and
 * `lineItem.dbSignal` are applied inside `emitDbLineDetectors`. Repeat-collapse and full-line
 * ingest both call `emitDbLineDetectors` so arg-variant bursts still register when rows
 * fold into `repeat-notification`. Synthetic rows are built in `viewer-data-add-db-detectors.ts`.
 *
 * **Repeat UI:** Non-SQL repeats add an inline `(×N)` badge on the original line (no notification row).
 * SQL fingerprint repeats still use one `repeat-notification` row updated in place with drilldown.
 */
const viewer_data_add_continuation_1 = require("./viewer-data-add-continuation");
const viewer_data_add_db_detectors_1 = require("./viewer-data-add-db-detectors");
const viewer_data_add_stack_group_learning_and_toggle_1 = require("./viewer-data-add-stack-group-learning-and-toggle");
const viewer_drift_debug_server_from_log_script_1 = require("./viewer-drift-debug-server-from-log-script");
const viewer_data_add_repeat_collapse_1 = require("./viewer-data-add-repeat-collapse");
const viewer_data_add_ascii_art_detect_1 = require("./viewer-data-add-ascii-art-detect");
const viewer_data_add_flutter_banner_1 = require("./viewer-data-add-flutter-banner");
const viewer_data_add_context_helpers_1 = require("./viewer-data-add-context-helpers");
function getViewerDataAddScript(staticSqlFromFingerprintEnabled = true) {
    return (0, viewer_drift_debug_server_from_log_script_1.getDriftDebugServerFromLogScript)() + (0, viewer_data_add_db_detectors_1.getViewerDataAddDbDetectorsScript)(staticSqlFromFingerprintEnabled) + (0, viewer_data_add_continuation_1.getContinuationScript)() + (0, viewer_data_add_repeat_collapse_1.getRepeatCollapseBranchScript)() + (0, viewer_data_add_ascii_art_detect_1.getAsciiArtDetectScript)() + (0, viewer_data_add_flutter_banner_1.getFlutterBannerScript)() + (0, viewer_data_add_context_helpers_1.getDataAddContextHelpersScript)() + /* javascript */ `
function addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier) {
    /* elapsedMs: per-line delay (from [+Nms]) for replay. qualityPercent: per-file line coverage (0-100) for badges. source: stream id for multi-source filter ('debug'|'terminal'|...). tier: 'flutter'|'device-critical'|'device-other'|'external' */
    var lineSource = source || 'debug';
    /* Tier resolution (controls which Log Sources radio — Flutter DAP / Device / External — gates visibility):
       1. Explicit tier param wins.
       2. fw === true  → 'device-other' (classifier matched logcat w/ non-flutter tag, Java/Android framework frame, etc.).
       3. fw === false → 'flutter'      (classifier matched user app code: workspace stack frame, I/flutter logcat, ...).
       4. Non-debug source (terminal, browser, drift-perf, saved log, ai-bash/ai-prompt/ai-edit, …) → 'external'.
       5. Fallback for DAP stdout/stderr/console where classifyFrame() returned undefined (plain print() /
          debugPrint() output — no logcat prefix, not a stack frame, not launch boilerplate): default to
          'flutter'. Without this default those lines carried tier=undefined and isTierHidden() bailed out
          via its early (!item.tier) return false, leaving the typical bulk of a Flutter app DAP output
          uncontrollable by the Flutter DAP radio — toggling All/Warn+/None appeared to do nothing.
          classifyLogLine() already tags launch boilerplate ("Launching…", VM Service connect) and logcat
          lines explicitly as 'device-other', so the remainder reaching this branch is legitimate app output. */
    var lineTier = tier || (fw === true ? 'device-other' : (fw === false ? 'flutter' : (lineSource !== 'debug' ? 'external' : 'flutter')));
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
    /* Structured file mode (plan 051): skip all log analysis for non-log files.
       Creates a plain info-level item with the same shape as a log item so
       calcItemHeight(), filters, search, and viewport work unchanged. */
    if (fileMode !== 'log') {
        if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
        // Honor current level filter on appended streaming lines — see calcLevelFiltered.
        var docItem = { html: html, rawText: rawText || null, type: 'line', height: (catFiltered || calcLevelFiltered('info')) ? 0 : ROW_HEIGHT, category: category, groupId: -1, timestamp: ts, level: 'info', seq: nextSeq++, sourceTag: null, logcatTag: null, sqlVerb: null, tier: undefined, filteredOut: catFiltered, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: false, classTags: [], isSeparator: false, errorClass: null, errorSuppressed: false, fw: undefined, sourcePath: sp || null, scopeFiltered: false, isAnr: false, autoHidden: false, source: lineSource, timeRangeFiltered: false, recentErrorContext: false, levelFiltered: calcLevelFiltered('info') };
        if (elapsedMs !== undefined && elapsedMs >= 0) docItem.elapsedMs = elapsedMs;
        allLines.push(docItem);
        totalHeight += docItem.height;
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
            // levelFiltered stamped at birth so frames inheriting a filtered-out level (e.g. 'database') stay hidden when the header is later expanded.
            var sfItem = { html: html, rawText: rawText || null, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, tier: lineTier, level: activeGroupHeader.level, sourceTag: activeGroupHeader.sourceTag, logcatTag: activeGroupHeader.logcatTag, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsF, context: context, _appFrameIdx: appIdx, sourcePath: sp || null, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource, levelFiltered: calcLevelFiltered(activeGroupHeader.level) };
            /* Inherit originalLevel from header so warnplus mode in calcItemHeight
               correctly shows frames from demoted device-other error/warning stacks. */
            if (activeGroupHeader.originalLevel) sfItem.originalLevel = activeGroupHeader.originalLevel;
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
        /* Find the previous non-marker line to get both its level and originalLevel.
           Device-other lines demote error/warning to info but store the pre-demotion
           level in originalLevel — warnplus mode needs this to keep stack headers
           visible when they follow a demoted error/warning line. */
        var _prevForHdr = null;
        for (var _ph = allLines.length - 1; _ph >= 0; _ph--) {
            var _phi = allLines[_ph];
            if (_phi.type !== 'marker' && _phi.type !== 'run-separator') { _prevForHdr = _phi; break; }
        }
        var _hdrLevel = previousLineLevel();
        var _hdrOrigLevel = (_prevForHdr && _prevForHdr.originalLevel) ? _prevForHdr.originalLevel : undefined;
        var hdrTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier, level: _hdrLevel, originalLevel: _hdrOrigLevel }) : false;
        // Stack header inherits _hdrLevel from the preceding line — a Drift SELECT header is 'database', must hide under the Database filter.
        var hdrH = (hdrAutoHide || catFiltered || hdrTierHidden || calcLevelFiltered(_hdrLevel)) ? 0 : ROW_HEIGHT;
        if (hdrAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        // Use configurable defaults: stackDefaultState (false/true/'preview'), stackPreviewCount (1-20).
        var _sds = (typeof stackDefaultState !== 'undefined') ? stackDefaultState : false;
        var _spc = (typeof stackPreviewCount !== 'undefined') ? stackPreviewCount : 3;
        var hdr = { html: html, rawText: rawText || null, type: 'stack-header', height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: _sds, previewCount: _spc, timestamp: ts, fw: fw, tier: lineTier, level: _hdrLevel, seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false, autoHidden: hdrAutoHide, qualityPercent: qualityPercent, source: lineSource, levelFiltered: calcLevelFiltered(_hdrLevel) };
        if (_hdrOrigLevel) hdr.originalLevel = _hdrOrigLevel;
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
    /* Structured line parsing: extract metadata (PID, TID, level, tag) from known log formats. */
    var slp = (typeof parseStructuredPrefix === 'function') ? parseStructuredPrefix(plain, sniffedFormatId) : null;
    var isSep = isSeparatorLine(slp ? slp.msg : plain);
    var isAi = category && category.indexOf('ai-') === 0;
    /* Flutter exception banner: classify every line in the \`════ Exception caught by …\` block
       (header + body + closing rule) under one bannerGroupId. Must run before lvl is chosen so
       we can override level to 'error' for every tagged line — body lines like "The following
       assertion was thrown during layout:" otherwise classify as info and drop out under the
       Errors/Warnings filter. slp?.msg uses the post-prefix message so structured logcat/bracket
       formats still hit the banner regex. */
    var bannerInfo = (typeof classifyFlutterBannerLine === 'function')
        ? classifyFlutterBannerLine(slp ? slp.msg : plain)
        : { groupId: -1, role: null };
    var lvl = isSep ? 'info' : isAi ? 'notice' : ((typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info');
    /* Override level for banner body/footer: they rarely carry an error keyword on their own
       but logically belong to the same incident as the banner header. */
    if (bannerInfo.groupId !== -1) lvl = 'error';
    /* Device-other: demote error/warning to info for display, but preserve original
       level for signal analysis — demoted warnings/errors must still feed the signal
       collector so recurring patterns are not silently suppressed (plan 050). */
    var preDemotionLevel = lvl;
    if (lineTier === 'device-other' && (lvl === 'error' || lvl === 'warning')) lvl = 'info';
    // Recent-error context: if this line is plain info but falls inside 2s after a real error/stack line
    // above (see Level Filters fly-up), it is tinted like an error so the incident reads as one band.
    // Those rows are flagged recentErrorContext and styled distinctly from the faulting line. Drift SQL
    // never gets this tint and is skipped when locating the prior error so it does not break the band.
    var skipProximityInherit = (typeof isDriftSqlStatementLine === 'function' && isDriftSqlStatementLine(plain));
    var recentErrorContext = false;
    /* Device-other lines are intentionally demoted (error/warning → info) to suppress
       framework noise.  Skip recentErrorContext so the demotion is not undone — these
       system messages (ActivityManager, WindowManager, etc.) are unrelated to the
       actual fault and should never show error-colored dots/borders. */
    if (lvl === 'info' && !isSep && !skipProximityInherit && lineTier !== 'device-other' && typeof proximityInheritAnchor === 'function') {
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

    // One parse per line: repeat tracker, dbSignal, and DB detectors share this object.
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
    /* Non-SQL repeats always add normally — the compress dedup algorithm
       (applyCompressDedupModes) groups them when compress mode is on,
       and all lines stay visible when it is off. Only SQL fingerprint
       repeats use handleRepeatCollapse for the drilldown notification row. */
    var shouldShowNormalLine = repeatTracker.count < minN || !repeatTracker.streakSqlFp;

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

        /* Pass level + originalLevel so isTierHidden can evaluate 'warnplus' mode —
           device-other lines demote error/warning to info but preserve the original. */
        var lineTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier, level: lvl, originalLevel: preDemotionLevel !== lvl ? preDemotionLevel : undefined }) : false;
        var classHidden = (typeof isClassFiltered === 'function' && isClassFiltered({ classTags: cTags, type: 'line' }));
        var isAutoHidden = (typeof testAutoHide === 'function') ? testAutoHide(plain) : false;
        // Streaming-lines filter gap: lines arriving after a level toggle bypassed the filter until applyLevelFilter() next ran.
        var lineH = (errorSuppressed || lineTierHidden || classHidden || catFiltered || calcLevelFiltered(lvl)) ? 0 : ROW_HEIGHT;
        var scopeFilt = (typeof calcScopeFiltered === 'function') ? calcScopeFiltered(sp) : false;
        var finalH = (scopeFilt || isAutoHidden) ? 0 : lineH;
        if (isAutoHidden && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
        var isAnr = (lvl === 'performance' && anrPattern.test(plain));
        var lineItem = { html: html, rawText: rawText || null, type: 'line', height: finalH, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, logcatTag: lTag, sqlVerb: sqlMeta ? sqlMeta.verb : null, tier: lineTier, filteredOut: catFiltered, sourceFiltered: false, sqlPatternFiltered: false, classFiltered: !!classHidden, classTags: cTags, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed, fw: fw, sourcePath: sp || null, scopeFiltered: scopeFilt, isAnr: isAnr, autoHidden: isAutoHidden, source: lineSource, timeRangeFiltered: false, recentErrorContext: recentErrorContext, levelFiltered: calcLevelFiltered(lvl), parsedPid: slp ? slp.pid : undefined, parsedTid: slp ? slp.tid : undefined, parsedTag: slp ? slp.tag : undefined, parsedRawLevel: slp ? slp.rawLvl : undefined, structuredPrefixLen: slp ? slp.prefixLen : 0, levelTooltip: (typeof getLevelTooltip === 'function' && slp) ? getLevelTooltip(slp.rawLvl, lvl) : ((typeof getLevelTooltip === 'function') ? getLevelTooltip(null, lvl) : null) };
        if (elapsedMs !== undefined && elapsedMs >= 0) lineItem.elapsedMs = elapsedMs;
        /* Only set originalLevel when demotion changed the display level — saves memory on
           the vast majority of lines where no demotion occurs (plan 050). */
        if (preDemotionLevel !== lvl) lineItem.originalLevel = preDemotionLevel;
        /* Attach Flutter banner group membership: consumed by the rendering pipeline
           (banner-group-start/mid/end CSS classes) so the whole exception block is
           visually cohesive — left border, background tint, rounded top/bottom. */
        if (bannerInfo.groupId !== -1) {
            lineItem.bannerGroupId = bannerInfo.groupId;
            lineItem.bannerRole = bannerInfo.role;
        }
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

${(0, viewer_data_add_stack_group_learning_and_toggle_1.getViewerDataAddStackGroupLearningAndToggleScript)()}
`;
}
//# sourceMappingURL=viewer-data-add.js.map