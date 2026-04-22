"use strict";
/**
 * Share history: recent Gist shares stored in workspace state for quick re-copy of links.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShareHistory = getShareHistory;
exports.addToShareHistory = addToShareHistory;
exports.clearShareHistory = clearShareHistory;
const SHARE_HISTORY_KEY = 'slc.shareHistory';
const MAX_RECENT_SHARES = 10;
async function getShareHistory(context) {
    const raw = context.workspaceState.get(SHARE_HISTORY_KEY, []);
    return raw.slice(0, MAX_RECENT_SHARES);
}
async function addToShareHistory(context, result, collectionName) {
    const entry = {
        gistId: result.gistId,
        deepLinkUrl: result.deepLinkUrl,
        gistUrl: result.gistUrl,
        collectionName,
        sharedAt: Date.now(),
    };
    const list = await getShareHistory(context);
    const filtered = list.filter((e) => e.gistId !== result.gistId);
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_SHARES);
    await context.workspaceState.update(SHARE_HISTORY_KEY, updated);
}
async function clearShareHistory(context) {
    await context.workspaceState.update(SHARE_HISTORY_KEY, []);
}
//# sourceMappingURL=share-history.js.map