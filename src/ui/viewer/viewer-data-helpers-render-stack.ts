/**
 * Stack-header and stack-frame row rendering — extracted from
 * viewer-data-helpers-render.ts as part of the severity-gutter decoupling
 * (see bugs/048_plan-severity-gutter-decoupling.md). Keeps the parent file
 * under the 300-line eslint `max-lines` limit and centralises the two
 * rendering branches that used to carry the overloaded outlined-dot state
 * for stack groups.
 *
 * Stack-header vocabulary: multi-frame stacks get an inline `.stack-toggle`
 * chevron (▶ / ▼) showing collapse state — IDE / debugger / file-explorer
 * convention. The whole header row is clickable via the existing
 * .stack-header[data-gid] handler (viewer-script-click-handlers.ts); the
 * chevron is the visual cue. 1-frame stacks (header only, no child frames)
 * omit the chevron and skip the toggle — nothing to expand. The prior
 * `.bar-hidden-rows` outlined-dot state on the gutter is gone.
 *
 * Stack-frame vocabulary: dedup-fold survivors do NOT get an affordance on
 * stack-frame rows in the current design — those rows have no line-number
 * prefix to host a counter-row chevron, and the prior inline trailing pill
 * competed with frame text content. Cross-type dedup is rare; the collapsed
 * duplicates remain reachable via the parent stack-header's expand toggle.
 *
 * Preview-mode trimmed-frame "more frames hidden" notice is also retired —
 * Preview-mode itself is still alive (header.collapsed === 'preview' state),
 * but the user expands trimmed frames via the stack-header's own ▶ / ▼
 * toggle. No separate divider row, no separate affordance.
 */
export function getStackHeaderRenderScript(): string {
    return /* javascript */ `
/** Render a single stack-header row. Called from renderItem() when item.type === 'stack-header'.
    The header carries a tooltip describing the trace state and an inline
    .stack-toggle chevron. Click anywhere on the row routes through the
    existing whole-row .stack-header[data-gid] handler. */
function renderStackHeader(item, idx, html, spacingCls, matchCls, barCls, idxAttr) {
    /* Tooltip + chevron glyph from the header's collapse state:
       - collapsed === true  : user (or default) collapsed the trace explicitly  → ▶
       - collapsed === false : fully expanded, no hidden frames                  → ▼
       - anything else       : Preview mode — some frames trimmed                → ▶
       WHY ▶ for both collapsed and preview: both states have hidden content the
       user could expand. ▼ would falsely signal "everything is shown". The
       chevron is the only affordance for preview mode — clicking it expands
       to fully expanded, exposing every trimmed frame. */
    /* 1-frame stacks (header only, no child frames) have nothing to
       expand/collapse — hide the chevron so the row does not look toggleable.
       frameCount includes the header itself, so >1 means children exist. */
    var _hasChildren = item.frameCount > 1;
    /* Same collapsible widget serves Dart stack traces AND Flutter render-tree
       descendant dumps (item.treeGroup, see viewer-data-add-tree-ingest.ts).
       The key family ('treeHeader'/'stackHeader') picks "Render tree"/"nodes"
       vs "Stack trace"/"frames"; vt() resolves localized full-sentence templates
       (strings-webview.ts) so word order stays correct per language. */
    var _fam = item.treeGroup ? 'viewer.treeHeader.' : 'viewer.stackHeader.';
    var _glyph = '\\u25b6';
    var _hdrTip = '';
    if (!_hasChildren) {
        _glyph = '';
        /* Trees never dedup, so only stacks reach the singleDup variant. */
        _hdrTip = (!item.treeGroup && item.dupCount > 1)
            ? vt('viewer.stackHeader.singleDup', item.dupCount)
            : vt(_fam + 'single');
    } else if (item.collapsed === true) {
        _hdrTip = vt(_fam + 'collapsed', item.frameCount - 1);
    } else if (item.collapsed === false) {
        _glyph = '\\u25bc';
        _hdrTip = vt(_fam + 'expanded');
    } else {
        _hdrTip = vt(_fam + 'preview');
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
    /* Stack-header renders through the same decoration prefix path as a
       regular log row — line number + chevron in the counter column,
       clickable. getCounterAffordance reads item.type === 'stack-header'
       and item.frameCount > 1 and emits the ▶/▼ chevron with
       data-affordance-kind="stack" data-stack-gid="<gid>". The whole
       .deco-counter-row wrapper is the click target (line number AND
       chevron), routed by handleCounterRowClick → toggleStackGroup.
       _hasChildren gate: 1-frame stacks have nothing to expand, so
       getCounterAffordance returns the bare counter + empty chevron
       spacer (same layout, no interactivity). */
    /* Plan 055 Phase 2: multi-frame stack headers join the overlap-proof gutter
       grid. getDecorationCells emits the line-number + chevron as a clipping
       counter-column .deco-cell (same buildDecoParts source as regular rows), and
       the header text/badges live in a min-width:0 .line-msg cell pinned to the
       message track — so a long header can never paint over the gutter and aligns
       under the same column as the surrounding log rows. .stack-header (not .line)
       keeps the whole-row collapse click handler; the .cols/.log-cols selectors in
       viewer-styles-columns.ts name .stack-header too. */
    var hdrDeco = (typeof getDecorationCells === 'function') ? getDecorationCells(item, idx, null) : '';
    return '<div class="stack-header cols log-cols' + hdrLevelCls + matchCls + spacingCls + barCls
        + hdrHeat + hdrCtxCls + '"' + idxAttr + hdrTitleAttr
        + ' data-gid="' + item.groupId + '">' + hdrDeco
        + '<span class="line-msg">' + hdrQb + html.trim() + dup + '</span></div>';
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
    /* Stack-frame dedup-fold affordance dropped: stack-frames have no
       line-number prefix to host a chevron, and the prior inline trailing
       pill at the END of frame text competed with the frame's own content.
       Cross-type dedup-fold across stack-frames is rare in practice; the
       collapsed duplicates remain accessible via the parent stack-header's
       expand toggle. Re-add here with a clear UX pattern if user demand
       surfaces. */
    var sfDupBadge = '';
    /* Context-pulled stack frames mute via .context-line so a Drift stack frame
       dragged in 3 rows before an unrelated error reads as background, not a
       participating frame. */
    var sfCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
    /* Plan 055 Phase 2: frames join the gutter grid. A frame carries no
       decoration, so it emits NO .deco-cell and its .line-msg lands in the message
       track (column 7) — nesting under the parent header's message automatically,
       no left-padding spacer to keep in sync. The one exception: a frame that is
       the last visible row before a filter-hidden gap must still surface the
       reveal chevron (or those hidden device rows are silently swallowed — user
       report 2026-06-07). Emit it as a counter-column .deco-cell so the click
       target stays in the gutter rather than in front of the frame text. */
    var sfDeco = '';
    if ((stackGutter || (item._hiddenAfter && item._hiddenAfter.count > 0))
        && typeof areDecorationsOn === 'function' && areDecorationsOn()
        && typeof getCounterAffordance === 'function') {
        var sfAfford = stackGutter ? stackGutter : getCounterAffordance(item, idx, item._hiddenAfter, '');
        sfDeco = '<span class="line-decoration"><span class="deco-cell deco-cell-num">' + sfAfford + '</span></span>';
    }
    return '<div class="line stack-line cols log-cols' + (item.fw ? ' framework-frame' : '')
        + matchCls + barCls + sfHeat + sfCtxCls + '"' + idxAttr + '>'
        + sfDeco + '<span class="line-msg">' + sfQb + html + sfDupBadge + '</span></div>';
}
`;
}
