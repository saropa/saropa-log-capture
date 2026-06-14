/**
 * On-disk types for the cross-session trigram search index (plan 029).
 * Stored at `.saropa/index/search/manifest.json`.
 */

/** One indexed log file: its identity, freshness stamps, and packed trigram set. */
export interface SearchIndexFileEntry {
    /** Path relative to the workspace folder (matches vscode.workspace.asRelativePath output). */
    readonly relativePath: string;
    /** File mtime (ms) at index time; a query compares this to the live stat to detect staleness. */
    readonly mtime: number;
    /** File size (bytes) at index time; a second freshness signal alongside mtime. */
    readonly sizeBytes: number;
    /** Base64 of the sorted little-endian Uint32Array trigram set (see search-index-trigram.ts). */
    readonly trigrams: string;
}

/** The whole index: a version stamp plus one entry per indexed log file. */
export interface SearchIndexManifest {
    readonly version: number;
    readonly updatedAt: number;
    readonly files: readonly SearchIndexFileEntry[];
}
