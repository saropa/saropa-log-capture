/**
 * Investigation mode data model types.
 * An investigation is a named collection of pinned sources (sessions and files)
 * that can be searched together and exported as a bundle.
 */

/** A source pinned to an investigation. */
export interface InvestigationSource {
    /** Source type: 'session' auto-includes sidecars, 'file' is standalone. */
    readonly type: 'session' | 'file';
    /** Path relative to workspace root (portable across machines). */
    readonly relativePath: string;
    /** Display name shown in UI. */
    readonly label: string;
    /** Timestamp when source was pinned (epoch ms). */
    readonly pinnedAt: number;
}

/** A named investigation containing pinned sources. */
export interface Investigation {
    /** Unique identifier (UUID). */
    readonly id: string;
    /** User-provided name, e.g. "Auth Timeout Bug #1234". */
    readonly name: string;
    /** Creation timestamp (epoch ms). */
    readonly createdAt: number;
    /** Last modification timestamp (epoch ms). */
    readonly updatedAt: number;
    /** Pinned sources in this investigation. */
    readonly sources: readonly InvestigationSource[];
    /** User notes/description (optional). */
    readonly notes?: string;
    /** Last search query for restoring state (optional). */
    readonly lastSearchQuery?: string;
}

/** Input for creating a new investigation. */
export interface CreateInvestigationInput {
    readonly name: string;
    readonly notes?: string;
}

/** Input for adding a source to an investigation. */
export interface AddSourceInput {
    readonly type: 'session' | 'file';
    readonly relativePath: string;
    readonly label: string;
}

/** Persisted format of the investigations file. */
export interface InvestigationsFile {
    readonly version: 1;
    readonly investigations: Investigation[];
}

/** Maximum number of investigations per workspace. */
export const MAX_INVESTIGATIONS = 50;

/** Maximum number of sources per investigation. */
export const MAX_SOURCES_PER_INVESTIGATION = 20;

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
    readonly source: InvestigationSource;
    readonly sourceFile: string;
    readonly matches: readonly SearchMatch[];
    readonly truncated: boolean;
    readonly largeFileWarning?: boolean;
}

/** Aggregated search results across all sources. */
export interface InvestigationSearchResult {
    readonly results: readonly SourceSearchResult[];
    readonly totalMatches: number;
    readonly totalSources: number;
    readonly cancelled: boolean;
    readonly searchTimeMs: number;
}

/** Known sidecar extensions that can be searched. */
export const SEARCHABLE_SIDECAR_EXTENSIONS = [
    '.terminal.log',
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
