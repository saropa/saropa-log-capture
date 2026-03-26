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

