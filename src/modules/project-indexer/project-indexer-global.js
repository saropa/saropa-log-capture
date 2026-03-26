"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGlobalProjectIndexer = setGlobalProjectIndexer;
exports.getGlobalProjectIndexer = getGlobalProjectIndexer;
let globalIndexer = null;
/** Set by extension when workspace is available. Used by trash/restore to update reports index. */
function setGlobalProjectIndexer(indexer) {
    globalIndexer = indexer;
}
function getGlobalProjectIndexer() {
    return globalIndexer;
}
//# sourceMappingURL=project-indexer-global.js.map