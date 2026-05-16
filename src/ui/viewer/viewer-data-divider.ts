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
    - _stackToggleGid : the NEXT visible row is a stack-header for a
                        multi-frame trace this row emitted. The toggle
                        moves OFF the stack-header (no more inline
                        chip in the middle of the row) and ONTO this
                        row's line-number column so the user expands /
                        collapses the trace from the line that owns it. */
function computeRowAffordances() {
    var prevVis = -1;
    for (var i = 0; i < allLines.length; i++) {
        // Clear stale stamps from previous render — affordance state changes when
        // filters toggle, peeks open / close, lines stream in.
        if (allLines[i]._hiddenAfter) allLines[i]._hiddenAfter = null;
        if (allLines[i]._triggeredPeekKey != null) allLines[i]._triggeredPeekKey = null;
        if (allLines[i]._stackToggleGid != null) allLines[i]._stackToggleGid = null;
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
            /* Stack-toggle takes ownership when the next visible row is a
               multi-frame stack-header. frameCount > 1 means there are
               child frames to expand/collapse (1-frame stacks have no
               toggle affordance because there is nothing to hide). The
               check runs regardless of in-allLines adjacency: filter-
               hidden lines between a log line and its trace don't disqualify
               the line from owning the trace's toggle. */
            if (allLines[i].type === 'stack-header' && allLines[i].frameCount > 1
                && allLines[prevVis].type !== 'stack-header'
                && allLines[prevVis].type !== 'stack-frame') {
                allLines[prevVis]._stackToggleGid = allLines[i].groupId;
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
        tip = tagPart + item.compressDupCount + ' identical row' + (item.compressDupCount !== 1 ? 's' : '')
            + (dupExpanded ? ' revealed \\u00b7 click to hide' : ' collapsed here \\u00b7 click to show');
    } else if (item._stackToggleGid != null && typeof groupHeaderMap !== 'undefined' && groupHeaderMap[item._stackToggleGid]) {
        /* Stack toggle takes priority over filter-hidden gap and peek
           because the stack-header is the IMMEDIATE next visible row —
           the user's mental model is "this line emitted a trace; click
           to expand". A gap or peek that nominally targets the same row
           refers to less-adjacent content. */
        var hdr = groupHeaderMap[item._stackToggleGid];
        var stackExpanded = (hdr.collapsed === false);
        kind = 'stack';
        glyph = stackExpanded ? '\\u25bc' : '\\u25b6';
        dataAttrs = ' data-stack-gid="' + item._stackToggleGid + '"';
        var frameWord = (hdr.frameCount === 2) ? 'frame' : 'frames';
        tip = tagPart + 'stack trace \\u00b7 ' + (hdr.frameCount - 1) + ' ' + frameWord + ' \\u00b7 '
            + (stackExpanded ? 'click to collapse' : 'click to expand');
    } else if (hiddenAfter && hiddenAfter.count > 0) {
        kind = 'gap';
        glyph = '\\u25b6';
        dataAttrs = ' data-hidden-from="' + hiddenAfter.from + '" data-hidden-to="' + hiddenAfter.to + '"';
        var gapTip = (typeof buildHiddenTip === 'function') ? buildHiddenTip(hiddenAfter.info) : (hiddenAfter.count + ' hidden');
        tip = tagPart + gapTip + ' \\u00b7 click to show';
    } else if (item._triggeredPeekKey != null) {
        kind = 'peek';
        glyph = '\\u25bc';
        dataAttrs = ' data-peek-key="' + item._triggeredPeekKey + '"';
        tip = tagPart + 'revealed lines below \\u00b7 click to re-collapse';
    }

    /* Always emit the chevron span — even when there is no affordance —
       so the line-number column width stays identical row-to-row. An
       empty span with the .deco-chevron rule's fixed 0.9em width is the
       spacer; rows with an action fill it with the glyph. Without this
       spacer, rows with a chevron would sit ~0.9em wider than rows
       without one and the numeric column would zig-zag down the page. */
    var chev = '<span class="deco-chevron">' + glyph + '</span>';

    if (!kind) {
        /* No interactive affordance — return the counter + empty-chevron
           spacer without a click wrapper, so the row is non-interactive
           but the column layout still matches affordance rows pixel-for-
           pixel. */
        return counterHtml + chev;
    }

    /* role="button" + aria-expanded encodes the toggle state for screen
       readers. The wrapper is the click target (delegated in
       viewer-peek-chevron.ts via .deco-counter-row[data-affordance-kind]),
       so both the line-number digits and the chevron glyph trigger the
       same action — the user can aim at either. */
    var expanded = (kind === 'peek'
        || (kind === 'dedup' && item.peekAnchorKey != null)
        || (kind === 'stack' && groupHeaderMap[item._stackToggleGid].collapsed === false)) ? 'true' : 'false';
    return '<span class="deco-counter-row" role="button" aria-expanded="' + expanded + '"'
        + ' data-affordance-kind="' + kind + '"' + dataAttrs
        + ' title="' + dividerHtmlAttrEscape(tip) + '">'
        + counterHtml + chev + '</span>';
}
`;
}
