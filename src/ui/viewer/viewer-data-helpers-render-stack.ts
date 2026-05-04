/**
 * Stack-header and stack-frame row rendering — extracted from
 * viewer-data-helpers-render.ts as part of the severity-gutter decoupling
 * (see bugs/048_plan-severity-gutter-decoupling.md). Keeps the parent file
 * under the 300-line eslint `max-lines` limit and centralises the two
 * rendering branches that used to carry the overloaded outlined-dot state
 * for stack groups.
 *
 * Stack-header vocabulary: an inline `.stack-toggle` chevron (▶ / ▼) inside
 * the header text shows collapse state — IDE / debugger / file-explorer
 * convention. The whole header row stays clickable via the existing
 * .stack-header[data-gid] handler (viewer-script-click-handlers.ts); the
 * chevron is the visual cue. The prior `.bar-hidden-rows` outlined-dot
 * state on the gutter is gone.
 *
 * Stack-frame vocabulary: dedup-fold survivors carry the same inline
 * `.dedup-badge` ("×N" / "×N hide") used by non-stack rows in
 * viewer-data-helpers-render.ts. Preview-mode trimmed-frame notices are
 * emitted by the render loop in viewer-data-viewport.ts as a sibling
 * `.viewer-divider` row directly below the last visible app-frame —
 * detection lives in viewer-data-divider.ts (`getPreviewModeHiddenInfo`),
 * not here, so this file no longer carries Preview-mode state.
 */
export function getStackHeaderRenderScript(): string {
    return /* javascript */ `
/** Render a single stack-header row. Called from renderItem() when item.type === 'stack-header'.
    The header carries a tooltip describing the trace state and an inline
    .stack-toggle chevron. Click anywhere on the row routes through the
    existing whole-row .stack-header[data-gid] handler. */
function renderStackHeader(item, html, spacingCls, matchCls, barCls, idxAttr) {
    /* Tooltip + chevron glyph from the header's collapse state:
       - collapsed === true  : user (or default) collapsed the trace explicitly  → ▶
       - collapsed === false : fully expanded, no hidden frames                  → ▼
       - anything else       : Preview mode — some frames trimmed                → ▶
       WHY ▶ for both collapsed and preview: both states have hidden content the
       user could expand. ▼ would falsely signal "everything is shown". The
       trailing .viewer-divider below the last visible app-frame (rendered by
       viewer-data-viewport.ts) carries the exact trimmed-frame count for the
       preview case, so the chevron does not need to disambiguate further. */
    var _glyph = '\\u25b6';
    var _hdrTip = '';
    if (item.collapsed === true) {
        _hdrTip = 'Stack trace collapsed'
            + (item.frameCount > 1 ? ' \\u00b7 ' + (item.frameCount - 1) + ' frames' : '')
            + ' \\u00b7 click to expand';
    } else if (item.collapsed === false) {
        _glyph = '\\u25bc';
        _hdrTip = 'Stack trace expanded \\u00b7 click to collapse';
    } else {
        _hdrTip = 'Stack trace \\u00b7 preview mode \\u00b7 click to expand all';
    }
    var dup = item.dupCount > 1
        ? ' <span class="stack-dedup-badge">(x' + item.dupCount + ')</span>'
        : '';
    var hdrQb = (typeof getQualityBadge === 'function') ? getQualityBadge(item) : '';
    var hdrHeat = (item.qualityPercent != null && typeof decoShowQuality !== 'undefined' && decoShowQuality)
        ? (item.qualityPercent >= 80 ? ' line-quality-high'
            : (item.qualityPercent >= 50 ? ' line-quality-med' : ' line-quality-low'))
        : '';
    /* Context-pulled rows must mute (opacity 0.4) and drop their level color so
       they read as background — otherwise a stack header dragged in as context
       for a nearby error keeps its full-color level-database tint and looks
       like primary content. The !item.isContext guard mirrors the main-line
       rule in viewer-data-helpers-render.ts and is asserted by
       src/test/ui/viewer-context-line-muting.test.ts. */
    var hdrLevelCls = (item.level && !item.isContext) ? ' level-' + item.level : '';
    var hdrCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    var hdrTitleAttr = ' title="' + _hdrTip.replace(/"/g, '&quot;') + '"';
    /* Chevron sits at the START of the text content, before the quality badge
       and the header label — IDE convention. data-gid duplicates the row's
       attr so a click that lands on the chevron specifically still resolves
       to the same group via either selector path; the existing whole-row
       handler in viewer-script-click-handlers.ts (.stack-header[data-gid])
       wins because the chevron is inside the row. */
    var chev = '<span class="stack-toggle" data-gid="' + item.groupId + '">' + _glyph + '</span>';
    return '<div class="stack-header' + hdrLevelCls + matchCls + spacingCls + barCls
        + hdrHeat + hdrCtxCls + '"' + idxAttr + hdrTitleAttr
        + ' data-gid="' + item.groupId + '">' + chev + hdrQb + html.trim() + dup + '</div>';
}

/** Render a single stack-frame row. Called from renderItem() when item.type === 'stack-frame'.
    Dedup-fold survivors get the same inline .dedup-badge as non-stack rows
    (viewer-data-helpers-render.ts). Preview-mode trimmed-frame notices are
    sibling .viewer-divider rows pushed by the render loop — this function
    does not stamp any state class for that case anymore. */
function renderStackFrame(item, idx, html, matchCls, barCls, idxAttr, stackGutter) {
    var sfQb = (typeof getQualityBadge === 'function') ? getQualityBadge(item) : '';
    var sfHeat = (item.qualityPercent != null && typeof decoShowQuality !== 'undefined' && decoShowQuality)
        ? (item.qualityPercent >= 80 ? ' line-quality-high'
            : (item.qualityPercent >= 50 ? ' line-quality-med' : ' line-quality-low'))
        : '';
    /* Dedup badge: inline "×N" / "×N hide" pill at the end of the frame
       text. Same WHY as the non-stack branch — keeping the badge attached
       to the row that owns the fold avoids the ambiguity a divider above
       or below would create. The .dedup-badge click delegate in
       viewer-peek-chevron.ts routes to peekDedupFold(idx) when collapsed
       or unpeekChevron(peekAnchorKey) when expanded. */
    var sfDupBadge = '';
    if (item.compressDupCount > 1) {
        var _sfExpanded = (item.peekAnchorKey !== undefined && item.peekAnchorKey !== null);
        var _sfLabel = '\\u00d7' + item.compressDupCount + (_sfExpanded ? ' hide' : '');
        var _sfCls = _sfExpanded ? 'dedup-badge dedup-badge-expanded' : 'dedup-badge';
        var _sfTitle = _sfExpanded
            ? item.compressDupCount + ' identical stack frames revealed \\u00b7 click to hide'
            : item.compressDupCount + ' identical stack frames collapsed here \\u00b7 click to show';
        sfDupBadge = '<span class="' + _sfCls + '" data-dedup-survivor-idx="' + idx + '" title="' + _sfTitle + '">' + _sfLabel + '</span>';
    }
    /* Context-pulled stack frames mute via .context-line so a Drift stack frame
       dragged in 3 rows before an unrelated error reads as background, not a
       participating frame. */
    var sfCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '')
        + matchCls + barCls + sfHeat + sfCtxCls + '"' + idxAttr + '>'
        + stackGutter + sfQb + html + sfDupBadge + '</div>';
}
`;
}
