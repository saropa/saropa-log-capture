import type { DocIndexEntry } from './project-indexer-types';

export interface RankedDocEntry {
    readonly doc: DocIndexEntry;
    readonly score: number;
}

export interface RankedTokenContribution {
    readonly token: string;
    readonly kind: 'exact' | 'leaf';
    readonly points: number;
}

export interface RankedDocDebugEntry extends RankedDocEntry {
    readonly contributions: readonly RankedTokenContribution[];
}

function tokenSignalWeight(token: string): number {
    let score = 1;
    if (token.includes(':')) { score += 5; } // dependency coordinates
    if (token.includes('.')) { score += 2; } // key paths / plugin ids / package ids
    if (token.includes('permission')) { score += 4; } // Android/iOS manifest signal
    if (token.includes('firebase') || token.includes('firestore')) { score += 3; }
    if (token.includes('gradle') || token.includes('plugin')) { score += 2; }
    if (token.includes('allow') || token.includes('match')) { score += 2; } // rules DSL signal
    if (token.length >= 18) { score += 1; } // long identifiers are often high-signal
    return score;
}

function scoreLeafFallback(queryToken: string, tokenSet: Set<string>): number {
    if (!queryToken.includes('.')) { return 0; }
    const leaf = queryToken.split('.').at(-1);
    if (!leaf || !tokenSet.has(leaf)) { return 0; }
    return 4 + tokenSignalWeight(leaf); // key path leaf fallback
}

function scoreDocForQueries(tokenSet: Set<string>, queries: readonly string[]): number {
    let score = 0;
    for (const query of queries) {
        if (tokenSet.has(query)) {
            score += 10 + tokenSignalWeight(query); // exact token match is strongest
            continue;
        }
        score += scoreLeafFallback(query, tokenSet);
    }
    return score;
}

export function rankDocEntriesByQueriesWithScores(entries: readonly DocIndexEntry[], queries: readonly string[]): RankedDocEntry[] {
    const scored: RankedDocEntry[] = [];
    for (const doc of entries) {
        if (!doc.tokens?.length) { continue; }
        const score = scoreDocForQueries(new Set(doc.tokens), queries);
        if (score > 0) { scored.push({ doc, score }); }
    }
    scored.sort((a, b) => b.score - a.score || b.doc.mtime - a.doc.mtime);
    return scored;
}

export function rankDocEntriesByQueries(entries: readonly DocIndexEntry[], queries: readonly string[]): DocIndexEntry[] {
    return rankDocEntriesByQueriesWithScores(entries, queries).map((item) => item.doc);
}

export function rankDocEntriesByQueriesWithDebug(entries: readonly DocIndexEntry[], queries: readonly string[]): RankedDocDebugEntry[] {
    const scored: RankedDocDebugEntry[] = [];
    for (const doc of entries) {
        if (!doc.tokens?.length) { continue; }
        const tokenSet = new Set(doc.tokens);
        const contributions: RankedTokenContribution[] = [];
        let score = 0;
        for (const query of queries) {
            if (tokenSet.has(query)) {
                const points = 10 + tokenSignalWeight(query);
                score += points;
                contributions.push({ token: query, kind: 'exact', points });
                continue;
            }
            if (!query.includes('.')) { continue; }
            const leaf = query.split('.').at(-1);
            if (!leaf || !tokenSet.has(leaf)) { continue; }
            const points = 4 + tokenSignalWeight(leaf);
            score += points;
            contributions.push({ token: leaf, kind: 'leaf', points });
        }
        if (score > 0) { scored.push({ doc, score, contributions }); }
    }
    scored.sort((a, b) => b.score - a.score || b.doc.mtime - a.doc.mtime);
    return scored;
}
