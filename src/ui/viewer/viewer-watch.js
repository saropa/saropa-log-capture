"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWatchScript = getWatchScript;
/**
 * Client-side JavaScript for keyword watch counter tracking in the log viewer.
 * Watch count display was removed from the footer (counts visible in status bar).
 * Retains the message handler so the extension host message is handled gracefully.
 */
function getWatchScript() {
    return /* javascript */ `
var watchCounts = {};

/** Handle watch count update from extension (display removed). */
function handleUpdateWatchCounts(msg) {
    if (msg.counts) { watchCounts = msg.counts; }
}
`;
}
//# sourceMappingURL=viewer-watch.js.map