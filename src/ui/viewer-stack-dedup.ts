/**
 * Client-side JavaScript for stack trace deduplication.
 * Tracks unique stack signatures and collapses duplicates into a count badge.
 */
export function getStackDedupScript(): string {
    return /* javascript */ `
var stackSignatures = {};

/** Called when a stack group ends. Hides duplicate groups and increments the original's count. */
function finalizeStackGroup(header) {
    var sig = '';
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].groupId === header.groupId) {
            sig += stripTags(allLines[i].html).trim() + '\\n';
        }
    }
    var existing = stackSignatures[sig];
    if (existing) {
        existing.dupCount = (existing.dupCount || 1) + 1;
        for (var i = 0; i < allLines.length; i++) {
            if (allLines[i].groupId !== header.groupId) continue;
            totalHeight -= allLines[i].height;
            allLines[i].height = 0;
        }
    } else {
        header.dupCount = 1;
        stackSignatures[sig] = header;
    }
}
`;
}
