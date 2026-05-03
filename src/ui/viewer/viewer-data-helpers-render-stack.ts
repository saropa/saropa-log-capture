/**
 * Stack-header and stack-frame row rendering — extracted from
 * viewer-data-helpers-render.ts as part of the unified line-collapsing rethink
 * (see bugs/unified-line-collapsing.md). Keeps the parent file under the
 * 300-line eslint `max-lines` limit and centralises the two rendering branches
 * that carry the outlined-dot state for stack groups.
 *
 * Stack-header vocabulary changes: the prior ▶ / ▼ / ▷ state triangle and the
 * `[+N frames]` / `[+N more]` suffix text are retired. The header row carries
 * state via `.bar-hidden-rows` + tooltip when fully collapsed; expanded and
 * Preview-mode headers render without the state class (Preview mode's owner
 * is the last visible frame, not the header — rule 3 in the plan).
 *
 * Stack-frame vocabulary changes: the frame at the preview cutoff (the
 * highest-index visible app frame when its header is in Preview mode) picks
 * up `.bar-hidden-rows` so the outlined dot signals "more frames below."
 * Dedup-fold survivors also pick it up (cross-type dedup from commit 4).
 */
export function getStackHeaderRenderScript(): string {
    return /* javascript */ `
/** Render a single stack-header row. Called from renderItem() when item.type === 'stack-header'. */
function renderStackHeader(item, html, spacingCls, matchCls, barCls, idxAttr) {
    /* Decide tooltip + outlined-dot state from the header's collapse state:
       - collapsed === true  : user (or default) collapsed the trace explicitly
       - collapsed === false : fully expanded, no hidden frames
       - anything else       : Preview mode — mark hidden iff some frames are trimmed */
    var _hdrHidden = false;
    var _hdrTip = '';
    if (item.collapsed === true) {
        _hdrHidden = true;
        _hdrTip = 'Stack trace collapsed'
            + (item.frameCount > 1 ? ' \\u00b7 ' + (item.frameCount - 1) + ' frames' : '')
            + ' \\u00b7 click to expand';
    } else if (item.collapsed === false) {
        _hdrHidden = false;
    } else {
        /* Preview mode: the rule-3 owner of the trimmed frames is the LAST
           VISIBLE FRAME inside the group (wired in viewer-data-helpers-render.ts
           stack-frame branch), not the header. The header stays solid-dotted
           here so we do not duplicate the indicator. */
        _hdrHidden = false;
    }
    var dup = item.dupCount > 1
        ? ' <span class="stack-dedup-badge">(x' + item.dupCount + ')</span>'
        : '';
    var hdrQb = (typeof getQualityBadge === 'function') ? getQualityBadge(item) : '';
    var hdrHeat = (item.qualityPercent != null && typeof decoShowQuality !== 'undefined' && decoShowQuality)
        ? (item.qualityPercent >= 80 ? ' line-quality-high'
            : (item.qualityPercent >= 50 ? ' line-quality-med' : ' line-quality-low'))
        : '';
    // Context-pulled rows must mute (opacity 0.4) and drop their level color so they
    // visually read as background — otherwise a stack header dragged in as context
    // for a nearby error keeps its full-color level-database tint and looks like
    // primary content. Mirrors the main-line rule in viewer-data-helpers-render.ts.
    var hdrLevelCls = (item.level && !item.isContext) ? ' level-' + item.level : '';
    var hdrCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    var hdrHiddenCls = _hdrHidden ? ' bar-hidden-rows' : '';
    var hdrTitleAttr = _hdrTip ? ' title="' + _hdrTip.replace(/"/g, '&quot;') + '"' : '';
    return '<div class="stack-header' + hdrLevelCls + matchCls + spacingCls + barCls
        + hdrHeat + hdrHiddenCls + hdrCtxCls + '"' + idxAttr + hdrTitleAttr
        + ' data-gid="' + item.groupId + '">' + hdrQb + html.trim() + dup + '</div>';
}

/** Render a single stack-frame row. Called from renderItem() when item.type === 'stack-frame'.
    Applies .bar-hidden-rows to the dedup-fold survivor (compressDupCount > 1) OR to the
    last visible frame of a Preview-mode stack group (rule 3). Dedup takes precedence if
    both apply, because it represents scattered duplicates and the preview indicator would
    be confusing alongside it. */
function renderStackFrame(item, html, matchCls, barCls, idxAttr, stackGutter) {
    var sfQb = (typeof getQualityBadge === 'function') ? getQualityBadge(item) : '';
    var sfHeat = (item.qualityPercent != null && typeof decoShowQuality !== 'undefined' && decoShowQuality)
        ? (item.qualityPercent >= 80 ? ' line-quality-high'
            : (item.qualityPercent >= 50 ? ' line-quality-med' : ' line-quality-low'))
        : '';
    var sfDupCls = (item.compressDupCount > 1) ? ' bar-hidden-rows' : '';
    var sfDupTitle = (item.compressDupCount > 1)
        ? ' title="' + item.compressDupCount + ' identical stack frames collapsed here \\u00b7 click to expand"'
        : '';
    /* data-dedup-count routes the click through peekDedupFold() so this one
       fold can be revealed without flipping the global compression toggle. */
    var sfDupDataAttr = (item.compressDupCount > 1)
        ? ' data-dedup-count="' + item.compressDupCount + '"'
        : '';
    var sfPrevCls = '';
    var sfPrevTitle = '';
    /* Preview-mode last-visible-frame detection: header in preview state, this
       frame is non-FW (FW frames always hidden in preview), its _appFrameIdx is
       at the cutoff boundary, and hidden content exists below. */
    if (!sfDupCls && typeof groupHeaderMap !== 'undefined' && item.groupId >= 0) {
        var _hdr = groupHeaderMap[item.groupId];
        if (_hdr && _hdr.collapsed !== true && _hdr.collapsed !== false && !item.fw) {
            var _appCnt = _hdr._appFrameCount || 0;
            var _prevCnt = _hdr.previewCount || 3;
            var _lastVisibleAppIdx = Math.min(_prevCnt, _appCnt) - 1;
            if (_lastVisibleAppIdx >= 0 && item._appFrameIdx === _lastVisibleAppIdx) {
                var _fwCnt = (_hdr.frameCount || 0) - _appCnt;
                var _hidden = Math.max(0, _appCnt - _prevCnt) + _fwCnt;
                if (_hidden > 0) {
                    sfPrevCls = ' bar-hidden-rows';
                    sfPrevTitle = ' title="' + _hidden + ' more stack frames below (Preview mode \\u00b7 '
                        + Math.min(_prevCnt, _appCnt) + ' of ' + (_hdr.frameCount || 0)
                        + ' shown) \\u00b7 click the header to show all"';
                }
            }
        }
    }
    var sfCombCls = sfDupCls || sfPrevCls;
    var sfCombTitle = sfDupTitle || sfPrevTitle;
    // Context-pulled stack frames mute via .context-line so a Drift stack frame dragged
    // in 3 rows before an unrelated error reads as background, not a participating frame.
    var sfCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '')
        + matchCls + barCls + sfHeat + sfCombCls + sfCtxCls + '"' + idxAttr + sfDupDataAttr + sfCombTitle + '>'
        + stackGutter + sfQb + html + '</div>';
}
`;
}
