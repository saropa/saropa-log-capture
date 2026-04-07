/**
 * Saropa Log Capture configuration — single source of truth for all extension settings.
 *
 * Reads from VS Code workspace/global config (section "saropaLogCapture"), applies
 * defaults, and exposes a typed SaropaLogCaptureConfig. Call getConfig() when you need
 * current values; config is not cached across settings changes.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import { normalizeViewerRepeatThresholds } from "../db/drift-db-repeat-thresholds";
import { normalizeViewerSlowBurstThresholds } from "../db/drift-db-slow-burst-thresholds";
import { parseSplitRules } from "../misc/file-splitter";
import { getIntegrationConfig, getProjectIndexConfig } from "./integration-config";
import { stripUiOnlyIntegrationAdapterIds } from "../integrations/integration-adapter-constants";
import {
  type ErrorRateConfig,
  type SaropaLogCaptureConfig,
  type ViewerDbDetectorToggles,
} from "./config-types";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FILE_TYPES,
  normalizeAutoTagRules,
  normalizeHighlightRules,
  normalizeWatchPatterns,
} from "./config-normalizers";
import {
  clamp,
  ensureBoolean,
  ensureEnum,
  ensureNonNegative,
  ensureStringArray,
} from "./config-validation";

export type {
  WatchPatternSetting,
  AiActivityConfig,
  SaropaLogCaptureConfig,
  ViewerDbDetectorToggles,
  ReplayConfig,
  IntegrationBuildCiConfig,
  IntegrationGitConfig,
  IntegrationEnvironmentConfig,
  IntegrationTestResultsConfig,
  IntegrationCoverageConfig,
  IntegrationCodeQualityConfig,
  IntegrationCrashDumpsConfig,
  IntegrationWindowsEventsConfig,
  IntegrationDockerConfig,
  IntegrationLokiConfig,
  IntegrationPerformanceConfig,
  IntegrationTerminalConfig,
  IntegrationLinuxLogsConfig,
  IntegrationExternalLogsConfig,
  IntegrationSecurityConfig,
  IntegrationDatabaseConfig,
  IntegrationHttpConfig,
  IntegrationBrowserConfig,
  IntegrationAdbLogcatConfig,
  IntegrationUnifiedLogConfig,
  ProjectIndexSourceConfig,
  ProjectIndexConfig,
} from "./config-types";

const SECTION = "saropaLogCapture";

export function getConfig(): SaropaLogCaptureConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const maxLines = clamp(cfg.get("maxLines"), 1000, 10_000_000, 100000);
  const viewerMaxLinesRaw = cfg.get("viewerMaxLines");
  const viewerMaxLines =
    typeof viewerMaxLinesRaw === "number" && Number.isFinite(viewerMaxLinesRaw) && viewerMaxLinesRaw >= 0
      ? Math.min(viewerMaxLinesRaw, maxLines)
      : 0;

  return {
    enabled: ensureBoolean(cfg.get("enabled"), true),
    aiActivity: {
      enabled: ensureBoolean(cfg.get("aiActivity.enabled"), true),
      autoDetect: ensureBoolean(cfg.get("aiActivity.autoDetect"), true),
      lookbackMinutes: clamp(cfg.get("aiActivity.lookbackMinutes"), 1, 1440, 30),
      showPrompts: ensureBoolean(cfg.get("aiActivity.showPrompts"), true),
      showReadOperations: ensureBoolean(cfg.get("aiActivity.showReadOperations"), false),
      showSystemWarnings: ensureBoolean(cfg.get("aiActivity.showSystemWarnings"), true),
    },
    categories: ensureStringArray(cfg.get("categories"), DEFAULT_CATEGORIES),
    maxLines,
    viewerMaxLines,
    viewerPreserveAsciiBoxArt: ensureBoolean(cfg.get("viewerPreserveAsciiBoxArt"), true),
    viewerGroupAsciiArt: ensureBoolean(cfg.get("viewerGroupAsciiArt"), true),
    includeTimestamp: ensureBoolean(cfg.get("includeTimestamp"), true),
    format: ensureEnum(cfg.get("format"), ["plaintext", "html"], "plaintext"),
    logDirectory: (() => {
      const v = cfg.get("logDirectory");
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : "reports";
    })(),
    reportFolder: (() => {
      const v = cfg.get("reportFolder");
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : "bugs";
    })(),
    lintReportImpactLevel: ensureEnum(cfg.get("lintReportImpactLevel"), ["essential", "recommended", "full"], "recommended"),
    autoOpen: ensureBoolean(cfg.get("autoOpen"), false),
    maxLogFiles: ensureNonNegative(cfg.get("maxLogFiles"), 0),
    gitignoreCheck: ensureBoolean(cfg.get("gitignoreCheck"), true),
    redactEnvVars: ensureStringArray(cfg.get("redactEnvVars"), []),
    exclusions: ensureStringArray(cfg.get("exclusions"), []),
    autoHidePatterns: ensureStringArray(cfg.get("autoHidePatterns"), []),
    showElapsedTime: ensureBoolean(cfg.get("showElapsedTime"), false),
    includeSourceLocation: ensureBoolean(cfg.get("includeSourceLocation"), false),
    includeElapsedTime: ensureBoolean(cfg.get("includeElapsedTime"), false),
    slowGapThreshold: clamp(cfg.get("slowGapThreshold"), 0, 86_400_000, 1000),
    watchPatterns: normalizeWatchPatterns(cfg.get("watchPatterns")),
    splitRules: parseSplitRules((cfg.get("splitRules") as Record<string, unknown>) ?? {}),
    autoTagRules: normalizeAutoTagRules(cfg.get("autoTagRules")),
    highlightRules: normalizeHighlightRules(cfg.get("highlightRules")),
    captureAll: ensureBoolean(cfg.get("captureAll"), true),
    filterContextLines: clamp(cfg.get("filterContextLines"), 0, 100, 3),
    contextViewLines: clamp(cfg.get("contextViewLines"), 0, 100, 10),
    copyContextLines: clamp(cfg.get("copyContextLines"), 0, 20, 3),
    suppressTransientErrors: ensureBoolean(cfg.get("suppressTransientErrors"), false),
    breakOnCritical: ensureBoolean(cfg.get("breakOnCritical"), false),
    minimapShowInfoMarkers: ensureBoolean(cfg.get("minimapShowInfoMarkers"), false),
    minimapShowSqlDensity: ensureBoolean(cfg.get("minimapShowSqlDensity"), true),
    minimapProportionalLines: ensureBoolean(cfg.get("minimapProportionalLines"), true),
    minimapViewportRedOutline: ensureBoolean(cfg.get("minimapViewportRedOutline"), false),
    minimapViewportOutsideArrow: ensureBoolean(cfg.get("minimapViewportOutsideArrow"), false),
    minimapWidth: ensureEnum(cfg.get("minimapWidth"), ["xsmall", "small", "medium", "large", "xlarge"], "medium"),
    showScrollbar: ensureBoolean(cfg.get("showScrollbar"), false),
    viewerAlwaysShowSearchMatchOptions: ensureBoolean(cfg.get("viewerAlwaysShowSearchMatchOptions"), false),
    viewerRepeatThresholds: normalizeViewerRepeatThresholds({
      globalMinCount: cfg.get("repeatCollapseGlobalMinCount"),
      readMinCount: cfg.get("repeatCollapseReadMinCount"),
      transactionMinCount: cfg.get("repeatCollapseTransactionMinCount"),
      dmlMinCount: cfg.get("repeatCollapseDmlMinCount"),
    }),
    viewerDbInsightsEnabled: ensureBoolean(cfg.get("viewerDbInsightsEnabled"), true),
    staticSqlFromFingerprintEnabled: ensureBoolean(cfg.get("staticSqlFromFingerprint.enabled"), true),
    viewerDbDetectorNPlusOneEnabled: ensureBoolean(cfg.get("viewerDbDetectorNPlusOneEnabled"), true),
    viewerDbDetectorSlowBurstEnabled: ensureBoolean(cfg.get("viewerDbDetectorSlowBurstEnabled"), true),
    viewerDbDetectorBaselineHintsEnabled: ensureBoolean(cfg.get("viewerDbDetectorBaselineHintsEnabled"), true),
    viewerSlowBurstThresholds: normalizeViewerSlowBurstThresholds({
      slowQueryMs: cfg.get("viewerSlowBurstSlowQueryMs"),
      burstMinCount: cfg.get("viewerSlowBurstMinCount"),
      burstWindowMs: cfg.get("viewerSlowBurstWindowMs"),
      cooldownMs: cfg.get("viewerSlowBurstCooldownMs"),
    }),

    deemphasizeFrameworkLevels: ensureBoolean(cfg.get("deemphasizeFrameworkLevels"), false),
    levelDetection: ensureEnum(cfg.get("levelDetection"), ["strict", "loose"], "strict"),
    stderrTreatAsError: ensureBoolean(cfg.get("stderrTreatAsError"), false),
    smartBookmarks: {
      suggestFirstError: ensureBoolean(cfg.get("smartBookmarks.suggestFirstError"), true),
      suggestFirstWarning: ensureBoolean(cfg.get("smartBookmarks.suggestFirstWarning"), false),
    },
    verboseDap: ensureBoolean(cfg.get("verboseDap"), false),
    diagnosticCapture: ensureBoolean(cfg.get("diagnosticCapture"), false),
    errorRateBucketSize: ensureEnum(cfg.get("errorRateBucketSize"), ["auto", "10s", "30s", "1m", "5m"], "auto"),
    errorRateShowWarnings: ensureBoolean(cfg.get("errorRateShowWarnings"), true),
    errorRateDetectSpikes: ensureBoolean(cfg.get("errorRateDetectSpikes"), true),
    fileTypes: ensureStringArray(cfg.get("fileTypes"), DEFAULT_FILE_TYPES),
    tailPatterns: ensureStringArray(cfg.get("tailPatterns"), ["**/*.log"]),
    docsScanDirs: ensureStringArray(cfg.get("docsScanDirs"), ["bugs", "docs"]),
    includeSubfolders: ensureBoolean(cfg.get("includeSubfolders"), true),
    treeRefreshInterval: ensureNonNegative(cfg.get("treeRefreshInterval"), 0),
    sessionListPageSize: clamp(cfg.get("sessionListPageSize"), 10, 500, 100),
    iconBarPosition: ensureEnum(cfg.get("iconBarPosition"), ["left", "right"], "left"),
    organizeFolders: ensureBoolean(cfg.get("organizeFolders"), true),
    integrationsAdapters: stripUiOnlyIntegrationAdapterIds(
      ensureStringArray(cfg.get("integrations.adapters"), ["packages", "performance"]),
    ),
    ...getIntegrationConfig(cfg),
    projectIndex: getProjectIndexConfig(cfg),
    replay: {
      defaultMode: ensureEnum(cfg.get("replay.defaultMode"), ["timed", "fast"], "timed"),
      /* 0.1–10 to match viewer speed dropdown (0.1x–10x). */
      defaultSpeed: clamp(cfg.get("replay.defaultSpeed"), 0.1, 10, 1),
      minLineDelayMs: clamp(cfg.get("replay.minLineDelayMs"), 0, 1000, 10),
      maxDelayMs: clamp(cfg.get("replay.maxDelayMs"), 1000, 300000, 30000),
    },
  };
}

export function getLogDirectoryUri(
  workspaceFolder: vscode.WorkspaceFolder | undefined | null,
): vscode.Uri {
  const config = getConfig();
  if (path.isAbsolute(config.logDirectory)) {
    return vscode.Uri.file(config.logDirectory);
  }
  if (!workspaceFolder?.uri) {
    return vscode.Uri.file(path.join(process.cwd(), config.logDirectory));
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, config.logDirectory);
}

/** URI for the bug report output folder. */
export function getReportFolderUri(
  workspaceFolder: vscode.WorkspaceFolder | undefined | null,
): vscode.Uri {
  const config = getConfig();
  if (path.isAbsolute(config.reportFolder)) {
    return vscode.Uri.file(config.reportFolder);
  }
  if (!workspaceFolder?.uri) {
    return vscode.Uri.file(path.join(process.cwd(), config.reportFolder));
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, config.reportFolder);
}

/** URI for extension tooling root (.saropa/). Index and caches live under here. */
export function getSaropaDirUri(workspaceFolder: vscode.WorkspaceFolder | undefined | null): vscode.Uri {
  if (!workspaceFolder?.uri) {
    return vscode.Uri.file(path.join(process.cwd(), '.saropa'));
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, '.saropa');
}

/** URI for Crashlytics cache directory (.saropa/cache/crashlytics/). */
export function getSaropaCacheCrashlyticsUri(workspaceFolder: vscode.WorkspaceFolder | undefined | null): vscode.Uri {
  return vscode.Uri.joinPath(getSaropaDirUri(workspaceFolder), 'cache', 'crashlytics');
}

/** URI for project index directory (.saropa/index/). */
export function getSaropaIndexDirUri(workspaceFolder: vscode.WorkspaceFolder | undefined | null): vscode.Uri {
  return vscode.Uri.joinPath(getSaropaDirUri(workspaceFolder), 'index');
}

/** Per-detector flags for the log viewer DB pipeline (when master DB insights is on). */
export function viewerDbDetectorTogglesFromConfig(cfg: SaropaLogCaptureConfig): ViewerDbDetectorToggles {
  return {
    nPlusOneEnabled: cfg.viewerDbDetectorNPlusOneEnabled,
    slowBurstEnabled: cfg.viewerDbDetectorSlowBurstEnabled,
    baselineHintsEnabled: cfg.viewerDbDetectorBaselineHintsEnabled,
  };
}

/** Error rate chart config for the viewer (bucketSize, showWarnings, detectSpikes). */
export function errorRateConfigFromConfig(cfg: SaropaLogCaptureConfig): ErrorRateConfig {
  return {
    bucketSize: cfg.errorRateBucketSize,
    showWarnings: cfg.errorRateShowWarnings,
    detectSpikes: cfg.errorRateDetectSpikes,
  };
}

export { isTrackedFile, readTrackedFiles, getFileTypeGlob, shouldRedactEnvVar } from './config-file-utils';
