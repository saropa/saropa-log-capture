/**
 * Saropa Log Capture configuration — single source of truth for all extension settings.
 *
 * Reads from VS Code workspace/global config (section "saropaLogCapture"), applies
 * defaults, and exposes a typed SaropaLogCaptureConfig. Call getConfig() when you need
 * current values; config is not cached across settings changes.
 */

import * as vscode from "vscode";
import * as path from "path";
import { parseSplitRules } from "../misc/file-splitter";
import { getIntegrationConfig, getProjectIndexConfig } from "./integration-config";
import type { HighlightRule } from "../storage/highlight-rules";
import type { AutoTagRule } from "../misc/auto-tagger";
import { defaultHighlightRules, type SaropaLogCaptureConfig, type WatchPatternSetting } from "./config-types";

export type {
  WatchPatternSetting,
  AiActivityConfig,
  SaropaLogCaptureConfig,
  IntegrationBuildCiConfig,
  IntegrationGitConfig,
  IntegrationEnvironmentConfig,
  IntegrationTestResultsConfig,
  IntegrationCoverageConfig,
  IntegrationCrashDumpsConfig,
  IntegrationWindowsEventsConfig,
  IntegrationDockerConfig,
  ProjectIndexSourceConfig,
  ProjectIndexConfig,
} from "./config-types";

const SECTION = "saropaLogCapture";

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
