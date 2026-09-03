/**
 * Tiny webview helper: stamp `sourceLineNo` from a batch `PendingLine` onto every item
 * the just-completed `addToData()` call pushed into `allLines`.
 *
 * Extracted out of `viewer-script-messages.ts` to keep that file under its `max-lines`
 * cap rather than burying multi-statement inline logic in the addLines dispatch loop.
 *
 * One input line can push multiple items (a stack-header + a synthetic repeat-notification
 * chip, a stack-frame folded into an open group, …). Bracketing the addToData call with
 * `before`/`allLines.length` catches them all. The skip-if-set guard preserves a chip's
 * original anchor line when subsequent input lines update the chip's count via the
 * `update-branch` path in `viewer-data-add-stack-header-repeat.ts`.
 */
export function getSourceLineStampScript(): string {
    return /* javascript */ `
function stampSourceLineNoOnNewItems(before, sourceLineNo) {
    if (sourceLineNo == null) return;
    for (var k = before; k < allLines.length; k++) {
        if (allLines[k].sourceLineNo === undefined) allLines[k].sourceLineNo = sourceLineNo;
    }
}

/*
 * bug_026: array position and sourceLineNo (the number shown in the gutter) drift apart once
 * synthetic rows (markers, stack headers, repeat-notification chips) are interleaved, so callers
 * that only have a gutter/file line number (Go-to-Line input, bookmarks, error snackbars, SQL query
 * history cross-log jumps — see viewer-message-handler-session-ui.ts 'scrollToLine' posts) MUST
 * resolve it through this lookup rather than using it directly as an allLines index. Internal
 * navigation that already knows the array position (trouble signals, run-nav, performance panel,
 * signal panel) keeps calling scrollToLineNumber directly and must NOT be routed through here.
 * Returns the allLines index for an exact sourceLineNo match, or the closest item's index when the
 * exact number was folded into a collapsed group / never stamped (e.g. a pure marker row) — only
 * -1 when allLines is empty, so a stale or slightly-off gutter number still lands somewhere useful
 * instead of silently doing nothing.
 */
function findAllLinesIndexBySourceLine(targetLine) {
    var closestIdx = -1;
    var closestDelta = Infinity;
    for (var i = 0; i < allLines.length; i++) {
        var sourceLineNo = allLines[i].sourceLineNo;
        if (sourceLineNo === undefined) continue;
        if (sourceLineNo === targetLine) return i;
        var delta = Math.abs(sourceLineNo - targetLine);
        if (delta < closestDelta) { closestDelta = delta; closestIdx = i; }
    }
    return closestIdx;
}
`;
}
