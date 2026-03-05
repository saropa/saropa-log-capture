/**
 * Configuration types and default highlight rules for Saropa Log Capture.
 * SaropaLogCaptureConfig is the single typed shape returned by getConfig(); integration
 * and project-index sub-shapes are defined here and merged in config.ts.
 */

import type { HighlightRule } from "../storage/highlight-rules";
import type { SplitRules } from "../misc/file-splitter";
import type { AutoTagRule } from "../misc/auto-tagger";

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
  readonly autoOpen: boolean;
  readonly maxLogFiles: number;
  readonly gitignoreCheck: boolean;
  readonly redactEnvVars: readonly string[];
  readonly exclusions: readonly string[];
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
  readonly deemphasizeFrameworkLevels: boolean;
  readonly levelDetection: "strict" | "loose";
  readonly verboseDap: boolean;
  readonly fileTypes: readonly string[];
  readonly tailPatterns: readonly string[];
  readonly docsScanDirs: readonly string[];
  readonly includeSubfolders: boolean;
  readonly treeRefreshInterval: number;
  readonly iconBarPosition: "left" | "right";
  readonly organizeFolders: boolean;
  readonly integrationsAdapters: readonly string[];
  readonly integrationsBuildCi: IntegrationBuildCiConfig;
  readonly integrationsGit: IntegrationGitConfig;
  readonly integrationsEnvironment: IntegrationEnvironmentConfig;
  readonly integrationsTestResults: IntegrationTestResultsConfig;
  readonly integrationsCoverage: IntegrationCoverageConfig;
  readonly integrationsCrashDumps: IntegrationCrashDumpsConfig;
  readonly integrationsWindowsEvents: IntegrationWindowsEventsConfig;
  readonly integrationsDocker: IntegrationDockerConfig;
  readonly integrationsLoki: IntegrationLokiConfig;
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

export interface IntegrationBuildCiConfig {
  readonly buildInfoPath: string;
  readonly fileMaxAgeMinutes: number;
}

export interface IntegrationGitConfig {
  readonly describeInHeader: boolean;
  readonly uncommittedInHeader: boolean;
  readonly stashInHeader: boolean;
  /** Show blame (commit, author) when navigating to source from a log line. */
  readonly blameOnNavigate: boolean;
  /** At session end, optionally capture git blame for file:line references in the log (e.g. stack frames). */
  readonly includeLineHistoryInMeta: boolean;
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

export interface IntegrationCrashDumpsConfig {
  readonly searchPaths: readonly string[];
  readonly extensions: readonly string[];
  readonly leadMinutes: number;
  readonly lagMinutes: number;
  readonly maxFiles: number;
  readonly includeInHeader: boolean;
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
}

/** Grafana Loki export (push log session to Loki). */
export interface IntegrationLokiConfig {
  readonly enabled: boolean;
  readonly pushUrl: string;
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

/**
 * Default highlight rules for common log patterns.
 * Priority-ordered: first match wins when multiple rules could apply.
 * Users can override via the `saropaLogCapture.highlightRules` setting.
 */
export function defaultHighlightRules(): HighlightRule[] {
  return [
    { pattern: "/\\b(fatal|panic|critical)\\b/i", color: "var(--vscode-errorForeground)", bold: true, label: "Fatal" },
    { pattern: "/\\b(error|exception|fail(ed|ure)?)\\b/i", color: "var(--vscode-errorForeground)", label: "Error" },
    { pattern: "/\\b(warn(ing)?|caution)\\b/i", color: "var(--vscode-editorWarning-foreground)", label: "Warning" },
    { pattern: "/\\b(todo|fixme|xxx)\\b/i", color: "var(--vscode-editorWarning-foreground)", italic: true, label: "TODO" },
    { pattern: "/\\b(hack|workaround|kludge)\\b/i", color: "var(--vscode-editorWarning-foreground)", italic: true, label: "Hack" },
    { pattern: "/\\bdeprecated\\b/i", color: "var(--vscode-descriptionForeground)", italic: true, label: "Deprecated" },
    { pattern: "/\\b(success(ful(ly)?)?|passed|succeeded)\\b/i", color: "var(--vscode-debugConsole-sourceForeground)", label: "Success" },
    { pattern: "/\\b(info(rmation)?|notice)\\b/i", color: "var(--vscode-debugConsole-infoForeground)", label: "Info" },
    { pattern: "/\\b(debug|trace|verbose)\\b/i", color: "var(--vscode-descriptionForeground)", label: "Debug" },
    { pattern: "[Awesome Notifications]", color: "var(--vscode-terminal-ansiGreen, #89d185)", scope: "keyword", label: "Awesome Notifications" },
  ];
}
