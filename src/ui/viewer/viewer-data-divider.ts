/**
 * Client-side helpers for the chevron that decorates the line-number column
 * on rows that "own" expandable / collapsible hidden content below them.
 *
 * Replaces the prior between-row `.viewer-divider` rows (filter-hidden gap
 * pill, peek-collapse bracket, preview-mode trimmed-frame notice) AND the
 * inline `.dedup-badge` chip at the end of dedup-fold survivors. Both
 * approaches had visual problems: floating between-row pills overlapped
 * with adjacent rows' tag chips, and trailing inline pills competed with
 * the row's own text content for attention.
 *
 * The new vocabulary: a single ▶ / ▼ chevron rendered immediately right of
 * the line number in the decoration prefix. The chevron + counter form one
 * click target (`.deco-counter-row`) so the whole numeric column is
 * interactive when any following content is collapsed. Tooltip carries the
 * count + reason + tag context.
 *
 * Affordance kinds the chevron currently routes:
 *   - data-affordance-kind="dedup"  : compressDupCount > 1 survivor
 *   - data-affordance-kind="gap"    : filter-hidden lines follow this row
 *   - data-affordance-kind="peek"   : this row triggered a now-expanded peek
 *
 * Stack-header rows do NOT use this path — they keep their inline
 * `.stack-toggle` chevron at the start of the header text because they have
 * no line-number prefix to attach to (see viewer-data-helpers-render-stack.ts).
 */
/** @deprecated kept only so legacy imports compile during the refactor —
 * returns an empty stub. The between-row .viewer-divider concept has been
 * replaced by .deco-counter-row + .deco-chevron in the line-number column.
 * See getCounterAffordanceScript below. Tests pinning the old API
 * (buildHiddenGapDivider, buildPeekHideDivider, etc.) need rewriting. */
export function getDividerRenderScript(_showCollapseDividerLabelsInitial = true): string {
    return '';
}

export function getCounterAffordanceScript(): string {
    return /* javascript */ `
/** Escape text for HTML attributes on the counter-row click target. */
function dividerHtmlAttrEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Stamp affordance state on every visible row in one forward pass over
    allLines. Runs once per renderViewport call BEFORE the DOM build loop
    so renderItem → getDecorationPrefix → getCounterAffordance can read
    the stamped info without each row scanning ahead.

    Stamps:
    - _hiddenAfter   : filter-hidden run between this row and the next
                       visible one (count > 0). Counter chevron offers
                       expand (▶) of the gap.
    - _triggeredPeekKey : this row sits immediately before items carrying
                          a peekAnchorKey it does NOT share — meaning it
                          triggered that peek. Counter chevron offers
                          collapse (▼) via the peek key.
    Stack-headers carry their own line-number + chevron via
    renderStackHeader → getDecorationPrefix; no stamping needed here. */
function computeRowAffordances() {
    var prevVis = -1;
    for (var i = 0; i < allLines.length; i++) {
        // Clear stale stamps from previous render — affordance state changes when
        // filters toggle, peeks open / close, lines stream in.
        if (allLines[i]._hiddenAfter) allLines[i]._hiddenAfter = null;
        if (allLines[i]._triggeredPeekKey != null) allLines[i]._triggeredPeekKey = null;
        if (allLines[i].height === 0) continue;
        if (prevVis >= 0) {
            if (i - prevVis > 1 && typeof countHiddenNonBlank === 'function') {
                var info = countHiddenNonBlank(prevVis + 1, i);
                if (info && info.count > 0) {
                    allLines[prevVis]._hiddenAfter = { count: info.count, from: prevVis + 1, to: i, info: info };
                }
            } else if (i - prevVis === 1) {
                /* Adjacent in allLines: detect peek-trigger pattern.
                   peekAnchorKey is set on items revealed under a peek; the
                   triggering row stays without the key. So a visible row
                   without the key followed by a visible row with the key
                   identifies the trigger. */
                var nextKey = allLines[i].peekAnchorKey;
                var prevKey = allLines[prevVis].peekAnchorKey;
                if (nextKey != null && prevKey !== nextKey) {
                    allLines[prevVis]._triggeredPeekKey = nextKey;
                }
            }
        }
        prevVis = i;
    }
}

/** Build the clickable counter+chevron wrapper for one row, OR return ''
    when no affordance applies (the caller then renders the bare counter).
    Priority order:
      1. dedup-fold survivor (compressDupCount > 1) — ▶ / ▼ on peekAnchorKey
      2. filter-hidden gap below (_hiddenAfter from the pre-pass) — ▶
      3. expanded peek triggered by this row (_triggeredPeekKey) — ▼

    Why this priority: dedup state is row-local data so it must win when
    present (the survivor IS what the user clicks to expand its hidden
    duplicates). A row can only carry one of these states at a time in
    practice — a dedup survivor never has _hiddenAfter (the hidden
    duplicates are tagged compressDupHidden, NOT filter-hidden), and a
    peek-trigger row's expanded peek replaces what would have been
    _hiddenAfter. */
function getCounterAffordance(item, idx, hiddenAfter, counterHtml) {
    var kind = null, glyph = '', tip = '', dataAttrs = '';
    var tagPart = item.parsedTag ? (item.parsedTag + ' \\u00b7 ') : '';

    if (item.compressDupCount > 1) {
        var dupExpanded = (item.peekAnchorKey != null);
        kind = 'dedup';
        glyph = dupExpanded ? '\\u25bc' : '\\u25b6';
        dataAttrs = ' data-dedup-survivor-idx="' + idx + '"';
        var dupNoun = (item.compressDupCount !== 1)
            ? vt('viewer.affordance.identicalRows.many', item.compressDupCount)
            : vt('viewer.affordance.identicalRows.one', item.compressDupCount);
        tip = tagPart + dupNoun
            + (dupExpanded ? vt('viewer.affordance.dedupExpandedAction') : vt('viewer.affordance.dedupCollapsedAction'));
    } else if (item.type === 'stack-header' && item.frameCount > 1) {
        /* Stack-header IS a collapsed row representing N hidden frames.
           Its own line number gets the chevron — click to expand the
           trace. ▶ when collapsed or in preview mode (some frames
           hidden); ▼ when fully expanded (all frames visible). */
        var stackExpanded = (item.collapsed === false);
        kind = 'stack';
        glyph = stackExpanded ? '\\u25bc' : '\\u25b6';
        dataAttrs = ' data-stack-gid="' + item.groupId + '"';
        var stackFrameN = item.frameCount - 1;
        var stackNoun = (item.frameCount === 2)
            ? vt('viewer.affordance.stackTrace.one', stackFrameN)
            : vt('viewer.affordance.stackTrace.many', stackFrameN);
        tip = tagPart + stackNoun
            + (stackExpanded ? vt('viewer.affordance.stackCollapseAction') : vt('viewer.affordance.stackExpandAction'));
    } else if (hiddenAfter && hiddenAfter.count > 0) {
        kind = 'gap';
        glyph = '\\u25b6';
        dataAttrs = ' data-hidden-from="' + hiddenAfter.from + '" data-hidden-to="' + hiddenAfter.to + '"';
        var gapTip = (typeof buildHiddenTip === 'function') ? buildHiddenTip(hiddenAfter.info) : vt('viewer.affordance.hiddenCount', hiddenAfter.count);
        tip = tagPart + gapTip + vt('viewer.affordance.gapShowAction');
    } else if (item._triggeredPeekKey != null) {
        kind = 'peek';
        glyph = '\\u25bc';
        dataAttrs = ' data-peek-key="' + item._triggeredPeekKey + '"';
        tip = tagPart + vt('viewer.affordance.peekRecollapse');
    }

    /* Always emit the chevron span with non-empty content (a non-breaking
       space when no glyph applies) so its layout box renders identically
       to a glyph-bearing span. An empty inline-block can collapse to zero
       width in some baseline / font contexts even with an explicit width,
       which shifts the digits left on chevron-less rows and breaks the
       numeric column alignment. */
    var chev = '<span class="deco-chevron">' + (glyph || '\\u00a0') + '</span>';

    /* Always wrap counter + chevron in .deco-counter-row, even when no
       interactive affordance applies. Without the wrapper, the bare counter
       + chevron pair lives directly inside .line-decoration and the inline
       formatting metrics (baseline, whitespace between siblings) differ
       subtly from the wrapped case — that's enough to shift the digits a
       fraction of an em between rows. One structure for every row keeps the
       numeric column straight; the data-affordance-kind attribute (present
       only on interactive rows) is what the click delegate and the cursor /
       hover CSS rules scope to. */
    var wrapperAttrs = '';
    if (kind) {
        var expanded = (kind === 'peek'
            || (kind === 'dedup' && item.peekAnchorKey != null)
            || (kind === 'stack' && item.collapsed === false)) ? 'true' : 'false';
        wrapperAttrs = ' role="button" aria-expanded="' + expanded + '"'
            + ' data-affordance-kind="' + kind + '"' + dataAttrs
            + ' title="' + dividerHtmlAttrEscape(tip) + '"';
    }
    return '<span class="deco-counter-row"' + wrapperAttrs + '>'
        + counterHtml + chev + '</span>';
}
`;
}
