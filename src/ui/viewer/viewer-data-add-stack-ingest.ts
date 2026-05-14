/**
 * Stack-line ingestion — extracted from viewer-data-add.ts to keep that file
 * under the eslint `max-lines` limit, following the established
 * `viewer-data-add-*.ts` chunking pattern (getContinuationScript,
 * getRepeatCollapseBranchScript, getStackHeaderRepeatScript, …).
 *
 * `tryIngestStackLine()` owns the decision of whether an incoming line is a
 * Dart/JS/Python stack frame, a stack header, or an async-gap marker, and if
 * so pushes it into the active stack group (or starts a new group). Returns
 * `true` when the line was consumed — `addToData()` then early-returns —
 * and `false` when the line is normal content for `addToData()` to handle.
 *
 * Shared webview-scope globals (allLines, activeGroupHeader, nextGroupId,
 * groupHeaderMap, totalHeight, nextSeq, …) are reachable directly because all
 * webview scripts are concatenated into one scope; only the per-line locals
 * are passed as parameters.
 */
export function getStackIngestScript(): string {
    return /* javascript */ `
/** Try to ingest \`html\` as a stack frame / header / async-gap. Returns true if consumed. */
function tryIngestStackLine(html, rawText, category, ts, fw, sp, elapsedMs, qualityPercent, lineSource, lineTier, catFiltered) {
    var isAsyncGap = isAsyncGapText(html);
    /* Async-gap markers ("<asynchronous suspension>") fold into an OPEN stack group as
       continuation frames. Without this they fail isStackFrameText(), hit the group-close
       path in addToData(), and shatter every Dart async trace into ~15 one-frame groups. A
       gap with no active group (orphan) makes this condition false and falls through to
       normal-line handling — a gap must never start a group on its own. */
    if (!(isStackFrameText(html) || (activeGroupHeader && isAsyncGap))) return false;
    resetCompressDupStreak();
    if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
    if (typeof finalizeArtBlock === 'function') finalizeArtBlock();
    var plainFrame = stripTags(html);
    var context = (typeof extractContext === 'function') ? extractContext(plainFrame) : null;

    if (activeGroupHeader) {
        /* Async gaps are payload-free framework noise: force fw=true so calcItemHeight
           hides them when the header is collapsed or in preview mode, and reveals them
           only on full expand (user can still inspect await boundaries when needed). */
        var frameFw = isAsyncGap ? true : fw;
        if (!activeGroupHeader._appFrameCount) activeGroupHeader._appFrameCount = 0;
        var appIdx = frameFw ? -1 : activeGroupHeader._appFrameCount;
        if (!frameFw) activeGroupHeader._appFrameCount++;
        var cTagsF = (typeof parseClassTags === 'function') ? parseClassTags(plainFrame) : [];
        if (cTagsF.length > 0 && activeGroupHeader.classTags) {
            for (var ci = 0; ci < cTagsF.length; ci++) {
                if (activeGroupHeader.classTags.indexOf(cTagsF[ci]) < 0) activeGroupHeader.classTags.push(cTagsF[ci]);
            }
        }
        // levelFiltered stamped at birth so frames inheriting a filtered-out level (e.g. 'database') stay hidden when the header is later expanded.
        var sfItem = { html: html, rawText: rawText || null, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: frameFw, tier: lineTier, level: activeGroupHeader.level, sourceTag: activeGroupHeader.sourceTag, logcatTag: activeGroupHeader.logcatTag, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsF, context: context, _appFrameIdx: appIdx, sourcePath: sp || null, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource, levelFiltered: calcLevelFiltered(activeGroupHeader.level), isAsyncGap: isAsyncGap };
        /* Inherit originalLevel from header so warnplus mode in calcItemHeight
           correctly shows frames from demoted device-other error/warning stacks. */
        if (activeGroupHeader.originalLevel) sfItem.originalLevel = activeGroupHeader.originalLevel;
        if (elapsedMs !== undefined && elapsedMs >= 0) sfItem.elapsedMs = elapsedMs;
        allLines.push(sfItem);
        /* Gaps are not real frames — counting them would inflate the header's
           "N frames" label and the preview/expand math. */
        if (!isAsyncGap) activeGroupHeader.frameCount++;
        return true;
    }
    /* bug_003: before allocating a new stack-group, try to fold this header into an
       active repeat streak. Consecutive identical Drift interceptor traces otherwise
       produce N separate header rows while surrounding SQL lines collapse — the
       visible inconsistency this fixes. Helper hides the anchor and creates/updates a
       "N × stack repeated" chip on match; points activeGroupHeader at the hidden
       anchor so any following frames flow into its (hidden) group. */
    if (typeof tryCollapseRepeatStackHeader === 'function' && tryCollapseRepeatStackHeader(html, plainFrame, ts, rawText)) return true;
    var gid = nextGroupId++;
    var sTagH = (typeof parseSourceTag === 'function') ? parseSourceTag(plainFrame) : null;
    var lTagH = (typeof parseLogcatTag === 'function') ? parseLogcatTag(plainFrame) : null;
    if (lTagH && lTagH === sTagH) lTagH = null;
    var cTagsH = (typeof parseClassTags === 'function') ? parseClassTags(plainFrame) : [];
    var hdrAutoHide = (typeof testAutoHide === 'function') ? testAutoHide(plainFrame) : false;
    /* Find the previous non-marker line for level/originalLevel AND source-tag
       fallback — traces belong to their parent line, so inherit sourceTag when the
       frame text has none (e.g. DB toggle hides orphaned DriftDebugInterceptor). */
    var _prevForHdr = null;
    for (var _ph = allLines.length - 1; _ph >= 0; _ph--) {
        var _phi = allLines[_ph];
        if (_phi.type !== 'marker' && _phi.type !== 'run-separator') { _prevForHdr = _phi; break; }
    }
    if (!sTagH && !lTagH && _prevForHdr) {
        sTagH = _prevForHdr.sourceTag || null;
        lTagH = _prevForHdr.logcatTag || null;
    }
    var _hdrLevel = previousLineLevel();
    var _hdrOrigLevel = (_prevForHdr && _prevForHdr.originalLevel) ? _prevForHdr.originalLevel : undefined;
    var hdrTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: lineTier, level: _hdrLevel, originalLevel: _hdrOrigLevel }) : false;
    var hdrH = (hdrAutoHide || catFiltered || hdrTierHidden || calcLevelFiltered(_hdrLevel)) ? 0 : ROW_HEIGHT;
    if (hdrAutoHide && typeof autoHiddenCount !== 'undefined') autoHiddenCount++;
    var _sds = (typeof stackDefaultState !== 'undefined') ? stackDefaultState : true;
    var _spc = (typeof stackPreviewCount !== 'undefined') ? stackPreviewCount : 3;
    var hdr = { html: html, rawText: rawText || null, type: 'stack-header', height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: _sds, previewCount: _spc, timestamp: ts, fw: fw, tier: lineTier, level: _hdrLevel, seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false, autoHidden: hdrAutoHide, qualityPercent: qualityPercent, source: lineSource, levelFiltered: calcLevelFiltered(_hdrLevel) };
    if (_hdrOrigLevel) hdr.originalLevel = _hdrOrigLevel;
    if (elapsedMs !== undefined && elapsedMs >= 0) hdr.elapsedMs = elapsedMs;
    allLines.push(hdr);
    if (typeof registerSourceTag === 'function') { registerSourceTag(hdr); }
    groupHeaderMap[gid] = hdr;
    activeGroupHeader = hdr;
    totalHeight += hdrH;
    return true;
}
`;
}
