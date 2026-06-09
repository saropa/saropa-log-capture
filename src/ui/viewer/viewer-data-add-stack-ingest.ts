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
/* HTML for the inline broken-chain glyph appended onto the prior frame in
   place of a standalone "<asynchronous suspension>" row. The visible icon
   comes from CSS ::before (not in DOM text), so it never lands on the
   clipboard. The raw phrase lives inside .async-gap-text using the sr-only
   pattern (position:absolute; clip): visually hidden but kept in the DOM so
   getSelection().toString() and stripTags() both capture it on copy.
   Click toggles .expanded which swaps the icon for the readable text. */
var ASYNC_GAP_GLYPH_HTML = '<span class="async-gap-glyph" role="button" tabindex="0" title="' + vt('viewer.stackIngest.asyncGapTitle') + '"><span class="async-gap-text">&lt;asynchronous suspension&gt;</span></span>';

/** Find the most recent row of the active stack group — the frame the inline
    gap glyph should attach to. Walks backwards because group rows are
    contiguous in allLines, so the first matching groupId is the latest. */
function findLastGroupRow() {
    if (!activeGroupHeader) return null;
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        if (it.groupId !== activeGroupHeader.groupId) continue;
        if (it.type === 'stack-frame' || it.type === 'stack-header') return it;
    }
    return null;
}

/** Try to ingest \`html\` as a stack frame / header / async-gap. Returns true if consumed. */
function tryIngestStackLine(html, rawText, category, ts, fw, sp, elapsedMs, qualityPercent, lineSource, lineTier, catFiltered) {
    var isAsyncGap = isAsyncGapText(html);
    /* The bare ")" that closes Dart's "_StringStackTrace (#0  …  )" object dump
       carries no frame info — pure formatting cruft. Without consuming it the
       ")" fails isStackFrameText(), hits the group-close path in addToData(),
       and renders as a junk ")" row after every trace. Dropped entirely (no
       row, no icon) since unlike an async gap it has no information to expand
       to. Guarded on activeGroupHeader so a stray ")" with no open trace stays
       a normal line and never starts a group on its own. */
    var isTraceTail = !!activeGroupHeader && /^\\)$/.test(stripTags(html).trim());
    /* Flutter elides long runs of framework frames into a single
       "...     Normal element mounting (N frames)" summary row. It is not a
       numbered frame, so without folding it into the OPEN group it fails
       isStackFrameText(), hits the group-close path in addToData(), and shatters
       one logical trace into separate collapsed segments at every elision (the
       bug: a single #0-#262 trace split into 5 toggles, one per "(N frames)").
       Guarded on activeGroupHeader so a stray summary with no open trace stays a
       normal line and never starts a group on its own. */
    var isElidedSummary = !!activeGroupHeader && typeof isElidedFramesSummary === 'function' && isElidedFramesSummary(html);
    /* Async-gap markers ("<asynchronous suspension>") fold into an OPEN stack group as
       an inline glyph on the previous frame. Without this they fail isStackFrameText(),
       hit the group-close path in addToData(), and shatter every Dart async trace into
       ~15 one-frame groups. A gap with no active group (orphan) makes this condition
       false and falls through to normal-line handling — a gap must never start a group
       on its own. */
    if (!(isStackFrameText(html) || (activeGroupHeader && (isAsyncGap || isTraceTail || isElidedSummary)))) return false;
    /* Trace-tail ")" is consumed silently — no row appended. Returning before the
       glyph-append branch below means we also do NOT emit a trailing icon: there is
       no async semantic to mark, the ")" is just _StringStackTrace's closing brace. */
    if (isTraceTail) return true;
    /* Async gap: append the broken-chain glyph to the previous frame in this
       group instead of creating a standalone row. Keeps the trace visually
       compact while preserving the original "<asynchronous suspension>" text
       in the DOM for selection/copy. frameCount is NOT incremented — gaps are
       not real frames. */
    if (isAsyncGap) {
        var anchor = findLastGroupRow();
        if (anchor) {
            anchor.html = (anchor.html || '') + ASYNC_GAP_GLYPH_HTML;
            /* rawText carries the original phrase verbatim so Alt+Shift+C
               (copyAsRawText) and search both still hit it. Separator is a
               single space to match the inline visual; tests assert on
               trailing "<asynchronous suspension>". */
            if (anchor.rawText != null) {
                anchor.rawText = anchor.rawText + ' <asynchronous suspension>';
            } else {
                anchor.rawText = stripTags(anchor.html || '');
            }
        }
        return true;
    }
    /* Elision summaries carry no app code — force the framework flag so they are
       never counted as the "first app frame" (_appFrameIdx) and so preview-collapse
       (which shows only app frames) hides them with the rest of the framework noise.
       lineTier was already resolved in addToData() from the original fw, so this
       override only affects the in-group app/framework treatment, not source-filter
       tier. The summary then falls through to the normal frame-push block below and
       becomes a visible, collapsible row inside the one unified group. */
    if (isElidedSummary) fw = true;
    /* Strip leading whitespace from frame text so the viewer's CSS owns the
       indent. Raw Dart stacks emit 6 leading spaces on every continuation frame
       ("      #2  Caller …"); combined with .stack-frames .line padding-left
       this pushed continuation frames further right than the header and broke
       column alignment under expansion. Regex preserves leading ANSI/dim
       <span> wrappers so dim styling on framework frames survives the trim. */
    html = html.replace(/^((?:<[^>]+>)*)\\s+/, '$1');
    resetCompressDupStreak();
    if (typeof breakContinuationGroup === 'function') breakContinuationGroup();
    if (typeof finalizeArtBlock === 'function') finalizeArtBlock();
    var plainFrame = stripTags(html);
    var context = (typeof extractContext === 'function') ? extractContext(plainFrame) : null;
    /* Render both Dart SDK and app frames member-first, with the code location as a
       muted right-aligned source tag — the member was previously shoved far right by the
       stack_trace alignment padding (worst for app frames, whose long ./lib/... paths set
       the widest column). App-frame source links are lifted intact so click-to-open and
       Ctrl+click-filter survive. Display-only: plainFrame, rawText, and the repeat-collapse
       comparison below all use the original html, so tag parsing, dedup, search, and raw
       copy are unchanged. */
    var displayHtml = (typeof formatFrameMemberFirst === 'function') ? formatFrameMemberFirst(html) : html;

    /* "The message IS the toggle" (one level — no separate stack-header sub-row).
       When a trace immediately follows a normal log line (its logical owner),
       promote THAT line to the stack group's header rather than emitting a
       separate stack-header from the first frame. The message then carries the
       collapse chevron and ALL frames fold under it as a single level. Falls
       through to the first-frame-header path below when there is no eligible
       owner (trace at file start, after a marker/separator, or after another
       trace) so a standalone trace still groups as its own single unit. */
    if (!activeGroupHeader) {
        var _prevItem = allLines.length > 0 ? allLines[allLines.length - 1] : null;
        /* Skip database / SQL lines: Drift interceptor traces follow a "Drift:
           Sent SELECT…" line and are handled by the dedicated SQL + stack-header
           repeat-collapse machinery (bug_003). Promoting that SQL line to an
           owner would bypass repeat-collapse and regress the Drift view. Every
           other normal log line is eligible. */
        var _ownerOk = !!_prevItem && _prevItem.type === 'line' && !_prevItem.isSeparator
            && _prevItem.groupId === -1
            && _prevItem.sourceTag !== 'database' && !_prevItem.sqlVerb
            && (typeof isLineContentBlank !== 'function' || !isLineContentBlank(_prevItem));
        if (_ownerOk) {
            var ogid = nextGroupId++;
            _prevItem.groupId = ogid;
            _prevItem._stackOwner = true;
            _prevItem.collapsed = (typeof stackDefaultState !== 'undefined') ? stackDefaultState : true;
            _prevItem.previewCount = (typeof stackPreviewCount !== 'undefined') ? stackPreviewCount : 3;
            /* frameCount counts the owner (header slot) + children, mirroring
               stack-header semantics so the tooltip shows frameCount-1 frames. */
            _prevItem.frameCount = 1;
            if (!_prevItem._appFrameCount) _prevItem._appFrameCount = 0;
            if (!_prevItem.classTags) _prevItem.classTags = [];
            groupHeaderMap[ogid] = _prevItem;
            activeGroupHeader = _prevItem;
        }
    }

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
        var sfItem = { html: displayHtml, rawText: rawText || null, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, tier: lineTier, level: activeGroupHeader.level, sourceTag: activeGroupHeader.sourceTag, logcatTag: activeGroupHeader.logcatTag, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsF, context: context, _appFrameIdx: appIdx, sourcePath: sp || null, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource, levelFiltered: calcLevelFiltered(activeGroupHeader.level) };
        /* Inherit originalLevel from header so warnplus mode in calcItemHeight
           correctly shows frames from demoted device-other error/warning stacks. */
        if (activeGroupHeader.originalLevel) sfItem.originalLevel = activeGroupHeader.originalLevel;
        if (elapsedMs !== undefined && elapsedMs >= 0) sfItem.elapsedMs = elapsedMs;
        allLines.push(sfItem);
        activeGroupHeader.frameCount++;
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
    var hdr = { html: displayHtml, rawText: rawText || null, type: 'stack-header', height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: _sds, previewCount: _spc, timestamp: ts, fw: fw, tier: lineTier, level: _hdrLevel, seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false, autoHidden: hdrAutoHide, qualityPercent: qualityPercent, source: lineSource, levelFiltered: calcLevelFiltered(_hdrLevel) };
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
