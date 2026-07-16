/**
 * Pinned-section rendering for the session panel.
 *
 * Lives in its own fragment (concatenated into the same IIFE as the main
 * rendering script) so viewer-session-panel-rendering.ts stays under the
 * 300-line limit. Relies on `renderItem`, `vt`, and `sessionDisplayOptions`
 * from sibling fragments in the shared scope.
 */

/** Get the pinned-section rendering script fragment. */
export function getPinnedRenderingScript(): string {
    return /* javascript */ `
    /* Newest pin first: pinnedAt is the epoch-ms stamp written at pin time. A 0/absent value
       (older pins from before the timestamp existed) sorts last, which is harmless. */
    function sortPinned(list) {
        return list.slice().sort(function(a, b) { return (b.pinnedAt || 0) - (a.pinnedAt || 0); });
    }

    /* Render the "Pinned" section: a heading with a count, then each pinned row via the shared
       renderItem so pinned logs show the same icon, dots, size, and metadata as normal rows.
       Returns '' when nothing is pinned so callers can prepend unconditionally. */
    function renderPinnedSection(pinnedList, bnCounts) {
        if (!pinnedList || pinnedList.length === 0) return '';
        var rows = '';
        for (var i = 0; i < pinnedList.length; i++) rows += renderItem(pinnedList[i], bnCounts);
        return '<div class="session-pinned-section">'
            + '<div class="session-pinned-heading">'
            + '<span class="codicon codicon-pin"></span> '
            + escapeHtmlText(vt('viewer.session.pinned.heading'))
            + ' <span class="session-day-count">' + pinnedList.length + '</span>'
            + '</div>'
            + rows
            + '</div>';
    }
`;
}
