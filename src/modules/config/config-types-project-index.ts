export interface ProjectIndexSourceConfig {
  readonly path: string;
  readonly fileTypes?: readonly string[];
  readonly enabled?: boolean;
}

/** Project index settings. */
export interface ProjectIndexConfig {
  readonly enabled: boolean;
  readonly sources: readonly ProjectIndexSourceConfig[];
  readonly includeRootFiles: boolean;
  readonly includeReports: boolean;
  readonly maxFilesPerSource: number;
  readonly refreshInterval: number;
}

/**
 * Incremental trigram search index settings (plan 029). The index only ever PRUNES the
 * candidate file set for literal cross-session searches — it never decides a match on its own,
 * so a stale/disabled index degrades to a full scan, never to a wrong result.
 */
export interface SearchIndexConfig {
  /** When false, cross-session search always does a full sequential scan (pre-index behavior). */
  readonly enabled: boolean;
  /** Soft cap on the on-disk index; oldest sessions are evicted (and fall back to scan) past it. */
  readonly maxSizeMB: number;
}

