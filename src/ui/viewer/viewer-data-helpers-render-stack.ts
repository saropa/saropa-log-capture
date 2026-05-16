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
function renderStackHeader(item, html, spacingCls, matchCls, barCls, idxAttr) {
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
    var _glyph = '\\u25b6';
    var _hdrTip = '';
    if (!_hasChildren) {
        _glyph = '';
        _hdrTip = 'Stack trace'
            + (item.dupCount > 1 ? ' \\u00b7 appeared ' + item.dupCount + ' times' : '');
    } else if (item.collapsed === true) {
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
    /* Stack-headers have no line-number prefix to attach a chevron to, so
       the toggle stays inline at the START of the header text — the OG
       "▶ stack" / "▼ stack" affordance, in normal row flow (not floating).
       data-gid lets a click on the chevron resolve to the same group via
       the dedicated handler in viewer-peek-chevron.ts even though the
       whole-row .stack-header[data-gid] handler in
       viewer-script-click-handlers.ts already catches clicks anywhere on
       the row. Omitted for 1-frame stacks (no children to toggle). */
    var chev = _hasChildren
        ? '<span class="stack-toggle" data-gid="' + item.groupId + '">' + _glyph + ' stack</span>\\u00a0'
        : '';
    /* Column alignment: a stack header carries no .line-decoration prefix, so
       without help it sits at the bare .stack-header padding-left (16px) while
       every decorated log line starts at --deco-prefix-width-em (~14.25em).
       The header then juts far out to the LEFT of the message column and reads
       as broken. line-deco-spacer-only reserves the same left padding (the
       exact pattern repeat-notification chips already use) so the header's
       chevron + text land in the content column. Gated on areDecorationsOn()
       because when decorations are off there is no column to align to. */
    var hdrDecoCls = (typeof areDecorationsOn === 'function' && areDecorationsOn())
        ? ' line-deco-spacer-only' : '';
    return '<div class="stack-header' + hdrLevelCls + matchCls + spacingCls + barCls
        + hdrHeat + hdrCtxCls + hdrDecoCls + '"' + idxAttr + hdrTitleAttr
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
    /* Column alignment: stack frames carry no .line-decoration prefix either, so
       without help they sit at the bare .line indent — LEFT of their own header
       once the header is pulled into the content column (see hdrDecoCls in
       renderStackHeader). line-deco-spacer-only reserves the same left padding so
       the expanded frames nest UNDER the header instead of jutting out past it.
       Gated on areDecorationsOn() to match the header's gate. */
    var sfDecoCls = (typeof areDecorationsOn === 'function' && areDecorationsOn())
        ? ' line-deco-spacer-only' : '';
    return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '')
        + matchCls + barCls + sfHeat + sfCtxCls + sfDecoCls + '"' + idxAttr + '>'
        + stackGutter + sfQb + html + sfDupBadge + '</div>';
}
`;
}
