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
`;
}
