/**
 * Collection mode data model types.
 * a collection is a named collection of pinned sources (sessions and files)
 * that can be searched together and exported as a bundle.
 */

/** A source pinned to a collection. */
export interface CollectionSource {
    /** Source type: 'session' auto-includes sidecars, 'file' is standalone. */
    readonly type: 'session' | 'file';
    /** Path relative to workspace root (portable across machines). */
    readonly relativePath: string;
    /** Display name shown in UI. */
    readonly label: string;
    /** Timestamp when source was pinned (epoch ms). */
    readonly pinnedAt: number;
}

/** A named collection containing pinned sources. */
export interface Collection {
    /** Unique identifier (UUID). */
    readonly id: string;
    /** User-provided name, e.g. "Auth Timeout Bug #1234". */
    readonly name: string;
    /** Creation timestamp (epoch ms). */
    readonly createdAt: number;
    /** Last modification timestamp (epoch ms). */
    readonly updatedAt: number;
    /** Pinned sources in this collection. */
    readonly sources: readonly CollectionSource[];
    /** User notes/description (optional). */
    readonly notes?: string;
    /** Last search query for restoring state (optional). */
    readonly lastSearchQuery?: string;
}

/** Input for creating a new collection. */
export interface CreateCollectionInput {
    readonly name: string;
    readonly notes?: string;
}

/** Input for adding a source to a collection. */
export interface AddSourceInput {
    readonly type: 'session' | 'file';
    readonly relativePath: string;
    readonly label: string;
}

/** Persisted format of the collections file. */
export interface CollectionsFile {
    readonly version: 1;
    readonly collections: Collection[];
}

/** Maximum number of collections per workspace. */
export const MAX_COLLECTIONS = 50;

/** Maximum number of sources per collection. */
export const MAX_SOURCES_PER_COLLECTION = 20;

/** Maximum file size to search fully (bytes). Files larger than this show a warning. */
export const MAX_SEARCH_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Maximum search results per source file. */
export const MAX_RESULTS_PER_SOURCE = 100;

/** Maximum search history entries. */
export const MAX_SEARCH_HISTORY = 10;

/** Search options for cross-source search. */
export interface SearchOptions {
    readonly query: string;
    readonly caseSensitive?: boolean;
    readonly useRegex?: boolean;
    readonly contextLines?: number;
    readonly maxResultsPerSource?: number;
}

/** A single search match within a file. */
export interface SearchMatch {
    readonly line: number;
    readonly column: number;
    readonly text: string;
    readonly contextBefore?: readonly string[];
    readonly contextAfter?: readonly string[];
}

/** Search results for a single source file (may be main log or sidecar). */
export interface SourceSearchResult {
    readonly source: CollectionSource;
    readonly sourceFile: string;
    readonly matches: readonly SearchMatch[];
    readonly truncated: boolean;
    readonly largeFileWarning?: boolean;
}

/** Aggregated search results across all sources. */
export interface CollectionSearchResult {
    readonly results: readonly SourceSearchResult[];
    readonly totalMatches: number;
    readonly totalSources: number;
    readonly cancelled: boolean;
    readonly searchTimeMs: number;
}

/** Known sidecar extensions that can be searched. */
export const SEARCHABLE_SIDECAR_EXTENSIONS = [
    '.terminal.log',
    '.unified.jsonl',
    '.requests.json',
    '.events.json',
    '.queries.json',
    '.browser.json',
    '.container.log',
    '.linux.log',
] as const;

/** Sidecar extensions to skip (numeric/binary data only). */
export const SKIP_SIDECAR_EXTENSIONS = [
    '.perf.json',
    '.crash-dumps.json',
    '.security.json',
    '.audit.json',
] as const;
