/**
 * Configuration types and default highlight rules for Saropa Log Capture.
 * SaropaLogCaptureConfig is the single typed shape returned by getConfig(); integration
 * and project-index sub-shapes are defined here and merged in config.ts.
 */

import type { HighlightRule } from "../storage/highlight-rules";
import type { SplitRules } from "../misc/file-splitter";
import type { AutoTagRule } from "../misc/auto-tagger";
export { defaultHighlightRules } from "./config-default-highlight-rules";

/** Smart bookmarks: suggest bookmark at first error (or warning) per session. */
export interface SmartBookmarksConfig {
  readonly suggestFirstError: boolean;
  readonly suggestFirstWarning: boolean;
}

/** Watch pattern entry from user settings. */
export interface WatchPatternSetting {
  readonly keyword: string;
  readonly alert?: "flash" | "badge" | "none";
}

/** AI activity overlay settings. */
export interface AiActivityConfig {
  readonly enabled: boolean;
  readonly autoDetect: boolean;
  readonly lookbackMinutes: number;
  readonly showPrompts: boolean;
  readonly showReadOperations: boolean;
  readonly showSystemWarnings: boolean;
}

export interface SaropaLogCaptureConfig {
  readonly enabled: boolean;
  readonly aiActivity: AiActivityConfig;
  readonly categories: readonly string[];
  readonly maxLines: number;
  /** Max lines shown in the viewer (0 = use default 50k). Must be ≤ maxLines. */
  readonly viewerMaxLines: number;
  readonly includeTimestamp: boolean;
  readonly format: "plaintext" | "html";
  readonly logDirectory: string;
  /** Folder for auto-created bug report files (relative to workspace root, or absolute path). */
  readonly reportFolder: string;
  /** Bug report lint section: which impact levels to include (essential = critical+high; recommended = +medium; full = all). */
  readonly lintReportImpactLevel: "essential" | "recommended" | "full";
  readonly autoOpen: boolean;
  readonly maxLogFiles: number;
  readonly gitignoreCheck: boolean;
  readonly redactEnvVars: readonly string[];
  readonly exclusions: readonly string[];
  /** Text patterns to auto-hide in the viewer. Lines containing any pattern (case-insensitive) are hidden. */
  readonly autoHidePatterns: readonly string[];
  readonly showElapsedTime: boolean;
  readonly slowGapThreshold: number;
  readonly watchPatterns: readonly WatchPatternSetting[];
  readonly splitRules: SplitRules;
  readonly autoTagRules: readonly AutoTagRule[];
  readonly highlightRules: readonly HighlightRule[];
  readonly includeSourceLocation: boolean;
  readonly includeElapsedTime: boolean;
  readonly showDecorations: boolean;
  readonly captureAll: boolean;
  readonly filterContextLines: number;
  readonly contextViewLines: number;
  /** Lines before/after selection to include in "Copy with source". 0 = selection only. */
  readonly copyContextLines: number;
  readonly suppressTransientErrors: boolean;
  readonly breakOnCritical: boolean;
  readonly minimapShowInfoMarkers: boolean;
  readonly minimapWidth: "small" | "medium" | "large";
  /** When true, show the native vertical scrollbar in the log viewer (default: false). */
  readonly showScrollbar: boolean;
  /** When true, always show match case / whole word / regex toggles in the log search strip (default: false). */
  readonly viewerAlwaysShowSearchMatchOptions: boolean;
  readonly deemphasizeFrameworkLevels: boolean;
  readonly levelDetection: "strict" | "loose";
  readonly smartBookmarks: SmartBookmarksConfig;
  readonly verboseDap: boolean;
  /** When true, log capture pipeline events to Output (session/buffer/write) for debugging empty logs. */
  readonly diagnosticCapture: boolean;
  readonly fileTypes: readonly string[];
  readonly tailPatterns: readonly string[];
  readonly docsScanDirs: readonly string[];
  readonly includeSubfolders: boolean;
  readonly treeRefreshInterval: number;
  /** Sessions per page in Project Logs panel (pagination). */
  readonly sessionListPageSize: number;
  readonly iconBarPosition: "left" | "right";
  readonly organizeFolders: boolean;
  readonly integrationsAdapters: readonly string[];
  readonly integrationsBuildCi: IntegrationBuildCiConfig;
  readonly integrationsGit: IntegrationGitConfig;
  readonly integrationsEnvironment: IntegrationEnvironmentConfig;
  readonly integrationsTestResults: IntegrationTestResultsConfig;
  readonly integrationsCoverage: IntegrationCoverageConfig;
  readonly integrationsCodeQuality: IntegrationCodeQualityConfig;
  readonly integrationsCrashDumps: IntegrationCrashDumpsConfig;
  readonly integrationsWindowsEvents: IntegrationWindowsEventsConfig;
  readonly integrationsDocker: IntegrationDockerConfig;
  readonly integrationsLoki: IntegrationLokiConfig;
  readonly integrationsPerformance: IntegrationPerformanceConfig;
  readonly integrationsTerminal: IntegrationTerminalConfig;
  readonly integrationsLinuxLogs: IntegrationLinuxLogsConfig;
  readonly integrationsExternalLogs: IntegrationExternalLogsConfig;
  readonly integrationsSecurity: IntegrationSecurityConfig;
  readonly integrationsDatabase: IntegrationDatabaseConfig;
  readonly integrationsHttp: IntegrationHttpConfig;
  readonly integrationsBrowser: IntegrationBrowserConfig;
  /** Optional merged session artifact (Phase 4): `basename.unified.jsonl` next to main log. */
  readonly integrationsUnifiedLog: IntegrationUnifiedLogConfig;
  readonly projectIndex: ProjectIndexConfig;
  readonly replay: ReplayConfig;
}

/** Session replay defaults (loaded log playback with optional timing). */
export interface ReplayConfig {
  readonly defaultMode: 'timed' | 'fast';
  readonly defaultSpeed: number;
  readonly minLineDelayMs: number;
  readonly maxDelayMs: number;
}

export type BuildCiSource = 'file' | 'github' | 'azure' | 'gitlab';

export interface IntegrationBuildCiConfig {
  readonly source: BuildCiSource;
  readonly buildInfoPath: string;
  readonly fileMaxAgeMinutes: number;
  /** Azure DevOps: organization name (required when source is azure). */
  readonly azureOrg: string;
  /** Azure DevOps: project name (required when source is azure). */
  readonly azureProject: string;
  /** GitLab: project ID (numeric or URL-encoded path, required when source is gitlab). */
  readonly gitlabProjectId: string;
  /** GitLab: API base URL (default https://gitlab.com). */
  readonly gitlabBaseUrl: string;
}

export interface IntegrationGitConfig {
  readonly describeInHeader: boolean;
  readonly uncommittedInHeader: boolean;
  readonly stashInHeader: boolean;
  /** Show blame (commit, author) when navigating to source from a log line. */
  readonly blameOnNavigate: boolean;
  /** At session end, optionally capture git blame for file:line references in the log (e.g. stack frames). */
  readonly includeLineHistoryInMeta: boolean;
  /** Resolve commit hashes to web URLs (GitHub, GitLab, Bitbucket) in blame and line history. */
  readonly commitLinks: boolean;
}

export interface IntegrationEnvironmentConfig {
  readonly includeEnvChecksum: boolean;
  readonly configFiles: readonly string[];
  readonly includeInHeader: boolean;
}

export interface IntegrationTestResultsConfig {
  readonly source: 'file' | 'junit';
  readonly lastRunPath: string;
  readonly junitPath: string;
  readonly fileMaxAgeHours: number;
  readonly includeFailedListInHeader: boolean;
}

export interface IntegrationCoverageConfig {
  readonly reportPath: string;
  readonly includeInHeader: boolean;
}

export interface IntegrationCodeQualityConfig {
  readonly lintReportPath: string;
  readonly scanComments: boolean;
  readonly coverageStaleMaxHours: number;
  /** Include quality summary (low coverage, lint issues) for referenced files in bug reports. */
  readonly includeInBugReport: boolean;
}

export interface IntegrationCrashDumpsConfig {
  readonly searchPaths: readonly string[];
  readonly extensions: readonly string[];
  readonly leadMinutes: number;
  readonly lagMinutes: number;
  readonly maxFiles: number;
  readonly includeInHeader: boolean;
  /** When true, copy discovered crash dump files into the session folder for portability. */
  readonly copyToSession: boolean;
}

export interface IntegrationWindowsEventsConfig {
  readonly logs: readonly string[];
  readonly levels: readonly string[];
  readonly leadMinutes: number;
  readonly lagMinutes: number;
  readonly maxEvents: number;
}

export interface IntegrationDockerConfig {
  readonly runtime: 'docker' | 'podman';
  readonly containerId: string;
  readonly containerNamePattern: string;
  readonly captureLogs: boolean;
  readonly maxLogLines: number;
  /** When true, write full docker inspect output as a sidecar JSON file. */
  readonly includeInspect: boolean;
}

/** Grafana Loki export (push log session to Loki). */
export interface IntegrationLokiConfig {
  readonly enabled: boolean;
  readonly pushUrl: string;
}

export interface IntegrationPerformanceConfig {
  readonly snapshotAtStart: boolean;
  readonly sampleDuringSession: boolean;
  readonly sampleIntervalSeconds: number;
  readonly includeInHeader: boolean;
  /** Path to an external profiler output file (e.g. .cpuprofile, .trace). Copied into the session folder at session end. */
  readonly profilerOutputPath: string;
  /** Capture memory usage of the debug target process (requires active debug session). */
  readonly processMetrics: boolean;
}

export interface IntegrationTerminalConfig {
  readonly whichTerminals: 'all' | 'active' | 'linked';
  readonly writeSidecar: boolean;
  readonly prefixTimestamp: boolean;
  readonly maxLines: number;
}

export interface IntegrationLinuxLogsConfig {
  readonly when: 'wsl' | 'remote' | 'always';
  readonly sources: readonly string[];
  readonly leadMinutes: number;
  readonly lagMinutes: number;
  readonly maxLines: number;
  readonly wslDistro: string;
}

export interface IntegrationExternalLogsConfig {
  readonly paths: readonly string[];
  readonly writeSidecars: boolean;
  readonly prefixLines: boolean;
  readonly maxLinesPerFile: number;
}

export interface IntegrationSecurityConfig {
  readonly windowsSecurityLog: boolean;
  readonly auditLogPath: string;
  readonly redactSecurityEvents: boolean;
}

export interface IntegrationDatabaseConfig {
  readonly mode: 'parse' | 'file' | 'api';
  readonly queryLogPath: string;
  readonly requestIdPattern: string;
  readonly timeWindowSeconds: number;
  readonly maxQueriesPerLookup: number;
}

export interface IntegrationHttpConfig {
  readonly requestIdPattern: string;
  readonly requestLogPath: string;
  readonly timeWindowSeconds: number;
  readonly maxRequestsPerSession: number;
}

export interface IntegrationBrowserConfig {
  readonly mode: 'file' | 'cdp';
  readonly browserLogPath: string;
  readonly browserLogFormat: 'jsonl' | 'json';
  readonly maxEvents: number;
}

/** Write `basename.unified.jsonl` merging main log + terminal + external sidecars (Phase 4). */
export interface IntegrationUnifiedLogConfig {
  readonly writeAtSessionEnd: boolean;
  /** Max lines per source (tail); bounds memory and file size. */
  readonly maxLinesPerSource: number;
}

/** Single source entry for project index (path + file types). */
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

