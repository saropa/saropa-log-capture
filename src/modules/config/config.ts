/**
 * Saropa Log Capture configuration — single source of truth for all extension settings.
 *
 * Reads from VS Code workspace/global config (section "saropaLogCapture"), applies
 * defaults, and exposes a typed SaropaLogCaptureConfig. Call getConfig() when you need
 * current values; config is not cached across settings changes.
 */

import * as vscode from "vscode";
import * as path from "path";
import { SplitRules, parseSplitRules } from "../misc/file-splitter";
import { AutoTagRule } from "../misc/auto-tagger";
import { HighlightRule } from "../storage/highlight-rules";
import { getIntegrationConfig, getProjectIndexConfig } from "./integration-config";

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
  /** Pattern-based highlight rules for coloring matching log lines. */
  readonly highlightRules: readonly HighlightRule[];
  /** Include DAP source file path and line number in each log line. */
  readonly includeSourceLocation: boolean;
  /** Show elapsed time since the previous log line in the log file. */
  readonly includeElapsedTime: boolean;
  /** Show decoration prefix (severity dot, counter, timestamp) in viewer. */
  readonly showDecorations: boolean;
  /** If true, capture all output (no filtering). */
  readonly captureAll: boolean;
  /** Number of preceding context lines shown when level filtering. */
  readonly filterContextLines: number;
  /** Number of lines before/after in context view modal. */
  readonly contextViewLines: number;
  /** Hide expected transient errors (TimeoutException, SocketException, etc.). */
  readonly suppressTransientErrors: boolean;
  /** Show notification when critical errors appear (NullPointerException, AssertionError, etc.). */
  readonly breakOnCritical: boolean;
  /** Show info-level (green) markers on the scrollbar minimap. */
  readonly minimapShowInfoMarkers: boolean;
  /** Width of the scrollbar minimap: small (40px), medium (60px), or large (90px). */
  readonly minimapWidth: "small" | "medium" | "large";
  /** Suppress error/warning text coloring on framework log lines (fw=true). */
  readonly deemphasizeFrameworkLevels: boolean;
  /** How aggressively to classify lines as errors: strict requires structural context, loose matches keywords anywhere. */
  readonly levelDetection: "strict" | "loose";
  /** Log all raw DAP protocol messages (requests, responses, events) to the log file. */
  readonly verboseDap: boolean;
  /** File extensions to include when listing sessions in the reports directory. */
  readonly fileTypes: readonly string[];
  /** Glob patterns for tail mode: watch and open workspace log files. */
  readonly tailPatterns: readonly string[];
  /** Directories to scan for project documentation references during analysis. */
  readonly docsScanDirs: readonly string[];
  /** Include log files from subdirectories of the log directory. */
  readonly includeSubfolders: boolean;
  /** Tree view refresh interval (seconds) during active recording. 0 = adaptive. */
  readonly treeRefreshInterval: number;
  /** Which side of the log viewer to show the icon bar. */
  readonly iconBarPosition: "left" | "right";
  /** Automatically move flat log files into date-based subfolders. */
  readonly organizeFolders: boolean;
  /** Integration adapter ids to enable (e.g. ["packages", "buildCi"]). Only these run. */
  readonly integrationsAdapters: readonly string[];
  /** Build/CI integration (file-based last-build.json). */
  readonly integrationsBuildCi: IntegrationBuildCiConfig;
  /** Git integration (describe, uncommitted, stash). */
  readonly integrationsGit: IntegrationGitConfig;
  /** Environment snapshot (env checksum, config file hashes). */
  readonly integrationsEnvironment: IntegrationEnvironmentConfig;
  /** Test results (last run file or JUnit). */
  readonly integrationsTestResults: IntegrationTestResultsConfig;
  /** Code coverage (lcov/summary file). */
  readonly integrationsCoverage: IntegrationCoverageConfig;
  /** Crash dumps (scan dirs at session end). */
  readonly integrationsCrashDumps: IntegrationCrashDumpsConfig;
  /** Windows Event Log (session end, Windows only). */
  readonly integrationsWindowsEvents: IntegrationWindowsEventsConfig;
  /** Docker/container (inspect + logs at end). */
  readonly integrationsDocker: IntegrationDockerConfig;
  /** Project index: docs/reports indexing for faster analysis. */
  readonly projectIndex: ProjectIndexConfig;
}

export interface IntegrationBuildCiConfig {
  readonly buildInfoPath: string;
  readonly fileMaxAgeMinutes: number;
}

export interface IntegrationGitConfig {
  readonly describeInHeader: boolean;
  readonly uncommittedInHeader: boolean;
  readonly stashInHeader: boolean;
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

const SECTION = "saropaLogCapture";

/**
 * Default highlight rules for common log patterns.
 * Priority-ordered: first match wins when multiple rules could apply.
 * Users can override via the `saropaLogCapture.highlightRules` setting.
 * Uses VS Code theme variables so colors adapt to light/dark themes.
 */
function defaultHighlightRules(): HighlightRule[] {
  return [
    {
      pattern: "/\\b(fatal|panic|critical)\\b/i",
      color: "var(--vscode-errorForeground)",
      bold: true,
      label: "Fatal",
    },
    {
      pattern: "/\\b(error|exception|fail(ed|ure)?)\\b/i",
      color: "var(--vscode-errorForeground)",
      label: "Error",
    },
    {
      pattern: "/\\b(warn(ing)?|caution)\\b/i",
      color: "var(--vscode-editorWarning-foreground)",
      label: "Warning",
    },
    {
      pattern: "/\\b(todo|fixme|xxx)\\b/i",
      color: "var(--vscode-editorWarning-foreground)",
      italic: true,
      label: "TODO",
    },
    {
      pattern: "/\\b(hack|workaround|kludge)\\b/i",
      color: "var(--vscode-editorWarning-foreground)",
      italic: true,
      label: "Hack",
    },
    {
      pattern: "/\\bdeprecated\\b/i",
      color: "var(--vscode-descriptionForeground)",
      italic: true,
      label: "Deprecated",
    },
    {
      pattern: "/\\b(success(ful(ly)?)?|passed|succeeded)\\b/i",
      color: "var(--vscode-debugConsole-sourceForeground)",
      label: "Success",
    },
    {
      pattern: "/\\b(info(rmation)?|notice)\\b/i",
      color: "var(--vscode-debugConsole-infoForeground)",
      label: "Info",
    },
    {
      pattern: "/\\b(debug|trace|verbose)\\b/i",
      color: "var(--vscode-descriptionForeground)",
      label: "Debug",
    },
    {
      pattern: "[Awesome Notifications]",
      color: "var(--vscode-terminal-ansiGreen, #89d185)",
      scope: "keyword",
      label: "Awesome Notifications",
    },
  ];
}

export function getConfig(): SaropaLogCaptureConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: cfg.get<boolean>("enabled", true),
    aiActivity: {
      enabled: cfg.get<boolean>("aiActivity.enabled", true),
      autoDetect: cfg.get<boolean>("aiActivity.autoDetect", true),
      lookbackMinutes: cfg.get<number>("aiActivity.lookbackMinutes", 30),
      showPrompts: cfg.get<boolean>("aiActivity.showPrompts", true),
      showReadOperations: cfg.get<boolean>("aiActivity.showReadOperations", false),
      showSystemWarnings: cfg.get<boolean>("aiActivity.showSystemWarnings", true),
    },
    categories: cfg.get<string[]>("categories", [
      "console",
      "stdout",
      "stderr",
    ]),
    maxLines: cfg.get<number>("maxLines", 100000),
    viewerMaxLines: cfg.get<number>("viewerMaxLines", 0),
    includeTimestamp: cfg.get<boolean>("includeTimestamp", true),
    format: cfg.get<"plaintext" | "html">("format", "plaintext"),
    logDirectory: cfg.get<string>("logDirectory", "reports"),
    autoOpen: cfg.get<boolean>("autoOpen", false),
    maxLogFiles: cfg.get<number>("maxLogFiles", 0),
    gitignoreCheck: cfg.get<boolean>("gitignoreCheck", true),
    redactEnvVars: cfg.get<string[]>("redactEnvVars", []),
    exclusions: cfg.get<string[]>("exclusions", []),
    showElapsedTime: cfg.get<boolean>("showElapsedTime", false),
    includeSourceLocation: cfg.get<boolean>("includeSourceLocation", false),
    includeElapsedTime: cfg.get<boolean>("includeElapsedTime", false),
    showDecorations: cfg.get<boolean>("showDecorations", true),
    slowGapThreshold: cfg.get<number>("slowGapThreshold", 1000),
    watchPatterns: cfg.get<WatchPatternSetting[]>("watchPatterns", [
      { keyword: "error", alert: "flash" },
      { keyword: "exception", alert: "flash" },
      { keyword: "warning", alert: "badge" },
    ]),
    splitRules: parseSplitRules(cfg.get("splitRules", {})),
    autoTagRules: cfg.get<AutoTagRule[]>("autoTagRules", []),
    highlightRules: cfg.get<HighlightRule[]>(
      "highlightRules",
      defaultHighlightRules(),
    ),
    captureAll: cfg.get<boolean>("captureAll", true),
    filterContextLines: cfg.get<number>("filterContextLines", 3),
    contextViewLines: cfg.get<number>("contextViewLines", 10),
    suppressTransientErrors: cfg.get<boolean>("suppressTransientErrors", false),
    breakOnCritical: cfg.get<boolean>("breakOnCritical", false),
    minimapShowInfoMarkers: cfg.get<boolean>("minimapShowInfoMarkers", false),
    minimapWidth: cfg.get<string>("minimapWidth", "medium") as "small" | "medium" | "large",
    deemphasizeFrameworkLevels: cfg.get<boolean>("deemphasizeFrameworkLevels", false),
    levelDetection: cfg.get<string>("levelDetection", "strict") as "strict" | "loose",
    verboseDap: cfg.get<boolean>("verboseDap", false),
    fileTypes: cfg.get<string[]>("fileTypes", [
      ".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html",
    ]),
    tailPatterns: cfg.get<string[]>("tailPatterns", ["**/*.log"]),
    docsScanDirs: cfg.get<string[]>("docsScanDirs", ["bugs", "docs"]),
    includeSubfolders: cfg.get<boolean>("includeSubfolders", true),
    treeRefreshInterval: cfg.get<number>("treeRefreshInterval", 0),
    iconBarPosition: cfg.get<string>("iconBarPosition", "left") as "left" | "right",
    organizeFolders: cfg.get<boolean>("organizeFolders", true),
    integrationsAdapters: cfg.get<string[]>("integrations.adapters", ["packages"]),
    ...getIntegrationConfig(cfg),
    projectIndex: getProjectIndexConfig(cfg),
  };
}

export function getLogDirectoryUri(
  workspaceFolder: vscode.WorkspaceFolder,
): vscode.Uri {
  const config = getConfig();
  if (path.isAbsolute(config.logDirectory)) {
    return vscode.Uri.file(config.logDirectory);
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, config.logDirectory);
}

/** URI for extension tooling root (.saropa/). Index and caches live under here. */
export function getSaropaDirUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(workspaceFolder.uri, '.saropa');
}

/** URI for Crashlytics cache directory (.saropa/cache/crashlytics/). */
export function getSaropaCacheCrashlyticsUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(getSaropaDirUri(workspaceFolder), 'cache', 'crashlytics');
}

/** URI for project index directory (.saropa/index/). */
export function getSaropaIndexDirUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(getSaropaDirUri(workspaceFolder), 'index');
}

export { isTrackedFile, readTrackedFiles, getFileTypeGlob, shouldRedactEnvVar } from './config-file-utils';
