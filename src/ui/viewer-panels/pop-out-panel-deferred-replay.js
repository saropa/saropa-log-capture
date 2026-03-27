"use strict";
/**
 * Pure helper for pop-out hydration: after loading the log from disk, live lines that arrived
 * during the async load must be replayed without duplicating lines already in the snapshot.
 * Session `lineCount` aligns with main log content line count for the cutoff.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterDeferredLinesAfterSnapshot = void 0;
/** Pick deferred live lines to append after a disk snapshot (see PopOutPanel.runHydrationFromDisk). */
function filterDeferredLinesAfterSnapshot(deferred, loadedContentLength) {
    if (loadedContentLength === undefined) {
        return [...deferred];
    }
    return deferred.filter((d) => d.lineCount > loadedContentLength);
}
exports.filterDeferredLinesAfterSnapshot = filterDeferredLinesAfterSnapshot;
//# sourceMappingURL=pop-out-panel-deferred-replay.js.map
