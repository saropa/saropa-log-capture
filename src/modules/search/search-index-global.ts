import type { SearchIndex } from './search-index';

let globalSearchIndex: SearchIndex | null = null;

/** Set by extension activation when a workspace folder is available; cleared on deactivate. */
export function setGlobalSearchIndex(index: SearchIndex | null): void {
    globalSearchIndex = index;
}

/** The active cross-session search index, or null when there is no workspace folder. */
export function getGlobalSearchIndex(): SearchIndex | null {
    return globalSearchIndex;
}
