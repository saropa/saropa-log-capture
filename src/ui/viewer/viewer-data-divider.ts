/**
 * Client-side helpers for the inline `.viewer-divider` rows that bracket
 * filter-hidden gaps, expanded peek ranges, and preview-mode trimmed-frame
 * notices in the log viewer.
 *
 * Extracted from viewer-data-viewport.ts so the render-loop file stays
 * comfortably under the 300-line eslint `max-lines` limit.
 *
 * The functions here build HTML strings; injection into the render loop
 * happens in viewer-data-viewport.ts. Click delegation lives in
 * viewer-peek-chevron.ts.
 *
 * See bugs/048_plan-severity-gutter-decoupling.md.
 */
export function getDividerRenderScript(): string {
    return /* javascript */ `
/** Build the HTML for an inline divider row that announces a filter-hidden
    gap between two visible log lines. Click → reveal the gap under a fresh
    peek key (peekChevron(from, to)).

    WHY a label inside the divider rather than an icon: the user must know
    BEFORE clicking what is hidden and how much. "12 hidden — show" beats
    a bare chevron because the latter's mystery cost was the original
    failure mode in plan 048. */
function buildHiddenGapDivider(from, to, info) {
    var n = info.count;
    var label = n + ' hidden line' + (n !== 1 ? 's' : '') + ' \\u00b7 show';
    var tip = (typeof buildHiddenTip === 'function') ? buildHiddenTip(info) : (n + ' hidden');
    /* role="button" + aria-expanded=false: the divider IS the affordance.
       Screen readers should announce it as an interactive control, not as
       descriptive prose between two log lines. */
    return '<div class="viewer-divider" role="button" aria-expanded="false"'
        + ' data-divider-action="show-gap"'
        + ' data-hidden-from="' + from + '"'
        + ' data-hidden-to="' + to + '"'
        + ' title="' + tip.replace(/"/g, '&quot;') + ' \\u00b7 click to show"'
        + '><span class="viewer-divider-label">\\u2500\\u2500\\u2500 ' + label + ' \\u2500\\u2500\\u2500</span></div>';
}

/** Build the HTML for a leading or trailing divider that brackets an
    expanded peek range. action='hide' collapses the group via
    unpeekChevron(peekKey). pos is 'start' or 'end' so the label can read
    "hide N revealed" (top) or "hide N revealed (above)" (bottom).

    WHY two dividers per peek (start AND end): collapse from the FAR end
    of an expansion eliminates the "I clicked near where I opened the
    expand control and lines I didn't ask to hide vanished" failure mode.
    The user can collapse from wherever they scrolled to. */
function buildPeekHideDivider(peekKey, count, pos) {
    var label = (pos === 'end')
        ? 'hide ' + count + ' revealed (above) \\u00b7 collapse'
        : 'hide ' + count + ' revealed \\u00b7 collapse';
    return '<div class="viewer-divider" role="button" aria-expanded="true"'
        + ' data-divider-action="hide-peek"'
        + ' data-peek-key="' + peekKey + '"'
        + ' data-peek-pos="' + pos + '"'
        + ' title="Re-hide the ' + count + ' lines revealed under this peek"'
        + '><span class="viewer-divider-label">\\u2500\\u2500\\u2500 ' + label + ' \\u2500\\u2500\\u2500</span></div>';
}

/** Detect whether a stack-frame is the LAST visible app-frame of a Preview-
    mode stack group (header.collapsed is neither true nor false; some frames
    are trimmed). Returns { hidden, total, shown } describing the trimmed
    frames so the divider label can carry exact counts, or null when this
    frame is not the preview cutoff.

    WHY the helper lives here (not in renderStackFrame): the trailing divider
    is a sibling row, not part of the frame's HTML. Detection has to happen
    in the render loop's outer scope so the divider can be pushed into
    parts[] right after the frame's row. */
function getPreviewModeHiddenInfo(item) {
    if (!item || item.type !== 'stack-frame') return null;
    if (typeof groupHeaderMap === 'undefined' || item.groupId == null || item.groupId < 0) return null;
    var hdr = groupHeaderMap[item.groupId];
    if (!hdr) return null;
    /* Preview mode is the "neither true nor false" header.collapsed state.
       In explicit collapsed/expanded states the trailing divider is owned
       by other paths (collapsed → no frames visible; expanded → no frames
       hidden). */
    if (hdr.collapsed === true || hdr.collapsed === false) return null;
    if (item.fw) return null;
    var appCnt = hdr._appFrameCount || 0;
    var prevCnt = hdr.previewCount || 3;
    var lastVisibleAppIdx = Math.min(prevCnt, appCnt) - 1;
    if (lastVisibleAppIdx < 0 || item._appFrameIdx !== lastVisibleAppIdx) return null;
    var fwCnt = (hdr.frameCount || 0) - appCnt;
    var hidden = Math.max(0, appCnt - prevCnt) + fwCnt;
    if (hidden <= 0) return null;
    return { hidden: hidden, total: hdr.frameCount || 0, shown: Math.min(prevCnt, appCnt), gid: item.groupId };
}

/** Build a "more frames hidden" divider for a preview-mode stack group.
    Click → expand the whole stack via toggleStackGroup(gid). The click
    handler dispatches on data-divider-action='show-frames'. */
function buildPreviewFramesDivider(info) {
    var label = info.hidden + ' more stack frame' + (info.hidden !== 1 ? 's' : '')
        + ' hidden \\u00b7 show all';
    var tip = 'Preview mode \\u00b7 ' + info.shown + ' of ' + info.total
        + ' frames shown \\u00b7 click to show all';
    return '<div class="viewer-divider" role="button" aria-expanded="false"'
        + ' data-divider-action="show-frames"'
        + ' data-gid="' + info.gid + '"'
        + ' title="' + tip + '"'
        + '><span class="viewer-divider-label">\\u2500\\u2500\\u2500 ' + label + ' \\u2500\\u2500\\u2500</span></div>';
}

/** Count the number of items currently sharing a peekAnchorKey. Used by
    buildPeekHideDivider to put an exact count in the label so the user
    knows how many lines collapse on click. */
function countPeekedLines(peekKey) {
    if (!(peekKey > 0) || typeof allLines === 'undefined') return 0;
    var n = 0;
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (it && it.peekAnchorKey === peekKey) n++;
    }
    return n;
}
`;
}
