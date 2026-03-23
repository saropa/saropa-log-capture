import type { DocIndexEntry, SourceIndexFile } from './project-indexer-types';
import { rankDocEntriesByQueriesWithDebug, rankDocEntriesByQueriesWithScores } from './project-indexer-ranking';
import type { RankedDocDebugEntry, RankedDocEntry } from './project-indexer-ranking';

export function queryDocEntriesByTokensWithScoresFromIndexes(
    sourceIndexes: Map<string, SourceIndexFile>,
    tokens: string[],
): RankedDocEntry[] {
    const lower = tokens.map((t) => t.toLowerCase());
    const docs = collectDocsFromIndexes(sourceIndexes);
    return rankDocEntriesByQueriesWithScores(docs, lower);
}

export function queryDocEntriesByTokensWithDebugFromIndexes(
    sourceIndexes: Map<string, SourceIndexFile>,
    tokens: string[],
): RankedDocDebugEntry[] {
    const lower = tokens.map((t) => t.toLowerCase());
    const docs = collectDocsFromIndexes(sourceIndexes);
    return rankDocEntriesByQueriesWithDebug(docs, lower);
}

function collectDocsFromIndexes(sourceIndexes: Map<string, SourceIndexFile>): DocIndexEntry[] {
    const result: DocIndexEntry[] = [];
    for (const [, idx] of sourceIndexes) {
        if (idx.sourceId === 'reports') { continue; }
        for (const f of idx.files) {
            const doc = f as DocIndexEntry;
            if (doc.tokens) { result.push(doc); }
        }
    }
    return result;
}
