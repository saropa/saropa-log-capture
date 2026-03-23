import type { ProjectIndexer } from './project-indexer';

let globalIndexer: ProjectIndexer | null = null;

/** Set by extension when workspace is available. Used by trash/restore to update reports index. */
export function setGlobalProjectIndexer(indexer: ProjectIndexer | null): void {
    globalIndexer = indexer;
}

export function getGlobalProjectIndexer(): ProjectIndexer | null {
    return globalIndexer;
}
