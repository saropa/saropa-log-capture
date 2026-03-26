"use strict";
/**
 * Investigation workspace state (active id, recent list, search history).
 * Extracted to keep investigation-store.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RECENT = exports.SEARCH_HISTORY_KEY = exports.RECENT_INVESTIGATIONS_KEY = exports.ACTIVE_INVESTIGATION_KEY = void 0;
exports.getActiveInvestigationId = getActiveInvestigationId;
exports.setActiveInvestigationId = setActiveInvestigationId;
exports.getRecentInvestigationIds = getRecentInvestigationIds;
exports.addToRecent = addToRecent;
exports.getSearchHistory = getSearchHistory;
exports.addToSearchHistory = addToSearchHistory;
exports.clearSearchHistory = clearSearchHistory;
const investigation_types_1 = require("./investigation-types");
exports.ACTIVE_INVESTIGATION_KEY = 'slc.activeInvestigationId';
exports.RECENT_INVESTIGATIONS_KEY = 'slc.recentInvestigationIds';
exports.SEARCH_HISTORY_KEY = 'slc.searchHistory';
exports.MAX_RECENT = 5;
async function getActiveInvestigationId(context) {
    return context.workspaceState.get(exports.ACTIVE_INVESTIGATION_KEY);
}
async function setActiveInvestigationId(context, id) {
    await context.workspaceState.update(exports.ACTIVE_INVESTIGATION_KEY, id);
    if (id) {
        await addToRecent(context, id);
    }
}
function getRecentInvestigationIds(context) {
    return context.workspaceState.get(exports.RECENT_INVESTIGATIONS_KEY, []);
}
async function addToRecent(context, id) {
    const recent = getRecentInvestigationIds(context);
    const filtered = recent.filter(r => r !== id);
    const updated = [id, ...filtered].slice(0, exports.MAX_RECENT);
    await context.workspaceState.update(exports.RECENT_INVESTIGATIONS_KEY, updated);
}
function getSearchHistory(context) {
    return context.workspaceState.get(exports.SEARCH_HISTORY_KEY, []);
}
async function addToSearchHistory(context, query) {
    if (!query.trim()) {
        return;
    }
    const history = getSearchHistory(context);
    const filtered = history.filter(q => q !== query);
    const updated = [query, ...filtered].slice(0, investigation_types_1.MAX_SEARCH_HISTORY);
    await context.workspaceState.update(exports.SEARCH_HISTORY_KEY, updated);
}
async function clearSearchHistory(context) {
    await context.workspaceState.update(exports.SEARCH_HISTORY_KEY, []);
}
//# sourceMappingURL=investigation-store-workspace.js.map