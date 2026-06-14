import type { TrigramSearchIndex } from './search-trigram-index';

let globalSearchIndex: TrigramSearchIndex | null = null;

/** Set by extension activation when a workspace folder is available; cleared on deactivate. */
export function setGlobalSearchIndex(index: TrigramSearchIndex | null): void {
    globalSearchIndex = index;
}

/** The active cross-session trigram search index, or null when there is no workspace folder. */
export function getGlobalSearchIndex(): TrigramSearchIndex | null {
    return globalSearchIndex;
}
