"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryDocEntriesByTokensWithScoresFromIndexes = queryDocEntriesByTokensWithScoresFromIndexes;
exports.queryDocEntriesByTokensWithDebugFromIndexes = queryDocEntriesByTokensWithDebugFromIndexes;
const project_indexer_ranking_1 = require("./project-indexer-ranking");
function queryDocEntriesByTokensWithScoresFromIndexes(sourceIndexes, tokens) {
    const lower = tokens.map((t) => t.toLowerCase());
    const docs = collectDocsFromIndexes(sourceIndexes);
    return (0, project_indexer_ranking_1.rankDocEntriesByQueriesWithScores)(docs, lower);
}
function queryDocEntriesByTokensWithDebugFromIndexes(sourceIndexes, tokens) {
    const lower = tokens.map((t) => t.toLowerCase());
    const docs = collectDocsFromIndexes(sourceIndexes);
    return (0, project_indexer_ranking_1.rankDocEntriesByQueriesWithDebug)(docs, lower);
}
function collectDocsFromIndexes(sourceIndexes) {
    const result = [];
    for (const [, idx] of sourceIndexes) {
        if (idx.sourceId === 'reports') {
            continue;
        }
        for (const f of idx.files) {
            const doc = f;
            if (doc.tokens) {
                result.push(doc);
            }
        }
    }
    return result;
}
//# sourceMappingURL=project-indexer-query.js.map