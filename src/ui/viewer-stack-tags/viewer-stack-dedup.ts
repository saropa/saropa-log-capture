/**
 * Client-side JavaScript for stack trace deduplication.
 * Tracks unique stack signatures and collapses duplicates into a count badge.
 */
export function getStackDedupScript(): string {
    return /* javascript */ `
var stackSignatures = {};

/** Called when a stack group ends. Hides duplicate groups and increments the original's count. */
function finalizeStackGroup(header) {
    // Scan backwards — group frames are contiguous at the tail of allLines.
    var sig = '';
    var groupStart = allLines.length;
    for (var i = allLines.length - 1; i >= 0; i--) {
        if (allLines[i].groupId !== header.groupId) break;
        sig = stripTags(allLines[i].html).trim() + '\\n' + sig;
        groupStart = i;
    }
    var existing = stackSignatures[sig];
    if (existing) {
        existing.dupCount = (existing.dupCount || 1) + 1;
        /* stackDedupHidden persists through recalcHeights — without it,
         * any filter change or toggle that triggers recalcHeights would
         * un-hide these duplicates because calcItemHeight has no other
         * gate for dedup-hidden stack items. Uses a separate flag from
         * compressDupHidden because applyCompressDedupModes clears that
         * flag on every recalc for its own line-level compress system. */
        for (var i = groupStart; i < allLines.length; i++) {
            if (allLines[i].groupId !== header.groupId) break;
            totalHeight -= allLines[i].height;
            allLines[i].height = 0;
            allLines[i].stackDedupHidden = true;
        }
    } else {
        header.dupCount = 1;
        stackSignatures[sig] = header;
    }
}
`;
}
