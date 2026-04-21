import type { ViewerRepeatThresholds } from "../db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../db/drift-db-slow-burst-thresholds";
import type { HighlightRule } from "../storage/highlight-rules";
import type { SplitRules } from "../misc/file-splitter";
import type { AutoTagRule } from "../misc/auto-tagger";
export { defaultHighlightRules } from "./config-default-highlight-rules";

import type {
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
  IntegrationFlutterCrashLogsConfig,
} from "./config-types-integrations";
import type { ProjectIndexConfig } from "./config-types-project-index";

/** User-configurable keyword lists per severity level. Each keyword is matched as a case-insensitive whole word. */
export interface SeverityKeywords {
  readonly error: readonly string[];
  readonly warning: readonly string[];
  readonly performance: readonly string[];
  readonly todo: readonly string[];
  readonly debug: readonly string[];
  readonly notice: readonly string[];
}

export interface SmartBookmarksConfig {
  readonly suggestFirstError: boolean;
  readonly suggestFirstWarning: boolean;
}

export interface WatchPatternSetting {
  readonly keyword: string;
  readonly alert?: "flash" | "badge" | "none";
}

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
  /**
   * When true (default), paired `│ … │` banner lines are not treated as stack frames in the viewer,
   * so stack preview does not collapse them with `[+N more]`.
   */
  readonly viewerPreserveAsciiBoxArt: boolean;
  /** When true (default), consecutive separator lines with the same timestamp are grouped into a single visual block. */
  readonly viewerGroupAsciiArt: boolean;
  /** Experimental: detect pixel-based ASCII art (logos, figlet banners) via entropy heuristics. Default off. */
  readonly viewerDetectAsciiArt: boolean;
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
  /** Minimum duration (ms) for a slow-operation signal. Operations faster than this are ignored. */
  readonly signalSlowOpThresholdMs: number;
  readonly slowGapThreshold: number;
  readonly watchPatterns: readonly WatchPatternSetting[];
  readonly splitRules: SplitRules;
  readonly autoTagRules: readonly AutoTagRule[];
  readonly highlightRules: readonly HighlightRule[];
  readonly includeSourceLocation: boolean;
  readonly includeElapsedTime: boolean;
  readonly captureAll: boolean;
  readonly filterContextLines: number;
  readonly contextViewLines: number;
  /** Lines before/after selection to include in "Copy with source". 0 = selection only. */
  readonly copyContextLines: number;
  readonly suppressTransientErrors: boolean;
  readonly breakOnCritical: boolean;
  readonly minimapShowInfoMarkers: boolean;
  /** Full-width pink/orange SQL activity shading on the log scroll map (ticks stay on top). */
  readonly minimapShowSqlDensity: boolean;
  /**
   * When true (default), scrollbar minimap markers use a VS Code–like width: text length vs log pane
   * width (capped at full width). When false, each marker spans the full minimap strip.
   */
  readonly minimapProportionalLines: boolean;
  /** Strong red outline on the minimap viewport slider (easier to see scroll position). */
  readonly minimapViewportRedOutline: boolean;
  /** Slim strip left of the minimap with a yellow arrow at the viewport center (optional). */
  readonly minimapViewportOutsideArrow: boolean;
  /** Scrollbar minimap width preset (pixel widths mapped in the webview). */
  readonly minimapWidth: "xsmall" | "small" | "medium" | "large" | "xlarge";
  /** When true, show the native vertical scrollbar in the log viewer (default: false). */
  readonly showScrollbar: boolean;
  /** When true, always show match case / whole word / regex toggles in the log search strip (default: false). */
  readonly viewerAlwaysShowSearchMatchOptions: boolean;
  /**
   * Real-time repeat-collapse thresholds for Drift `database`-tagged SQL (occurrence count before
   * collapsing into repeat rows). Non-SQL lines use `globalMinCount` only.
   */
  readonly viewerRepeatThresholds: ViewerRepeatThresholds;
  /** Master toggle: DB detectors (N+1, future burst/diff) and per-line dbSignal rollup in the viewer. */
  readonly viewerDbSignalsEnabled: boolean;
  /** When true, N+1 rows and host actions may offer “static sources” search from SQL fingerprints (DB_12). */
  readonly staticSqlFromFingerprintEnabled: boolean;
  /** Per-detector gates when `viewerDbSignalsEnabled` is true (plan DB_15 follow-ups). */
  readonly viewerDbDetectorNPlusOneEnabled: boolean;
  readonly viewerDbDetectorSlowBurstEnabled: boolean;
  /** Markers when live session SQL volume exceeds the comparison baseline for a fingerprint. */
  readonly viewerDbDetectorBaselineHintsEnabled: boolean;
  /** Markers when multiple DB queries fire at the same timestamp (plan DB_16). */
  readonly viewerDbDetectorTimestampBurstEnabled: boolean;
  /** Slow query burst marker thresholds in the log viewer (plan DB_08). */
  readonly viewerSlowBurstThresholds: ViewerSlowBurstThresholds;

  readonly levelDetection: "strict" | "loose";
  /**
   * When true, lines captured with DAP category `stderr` are forced to error level and stderr styling.
   * When false (default), stderr is classified from message text (logcat, Drift SQL, keywords) like other channels.
   */
  readonly stderrTreatAsError: boolean;
  readonly severityKeywords: SeverityKeywords;
  readonly smartBookmarks: SmartBookmarksConfig;
  readonly verboseDap: boolean;
  /** When true, log capture pipeline events to Output (session/buffer/write) for debugging empty logs. */
  readonly diagnosticCapture: boolean;
  /** Error rate chart bucket size: 'auto' adapts to session length; fixed values override. */
  readonly errorRateBucketSize: 'auto' | '10s' | '30s' | '1m' | '5m';
  /** Include warnings alongside errors in the error-rate chart. */
  readonly errorRateShowWarnings: boolean;
  /** Highlight anomalous error spikes via moving-average detection. */
  readonly errorRateDetectSpikes: boolean;
  readonly fileTypes: readonly string[];
  readonly tailPatterns: readonly string[];
  readonly docsScanDirs: readonly string[];
  readonly includeSubfolders: boolean;
  readonly treeRefreshInterval: number;
  /** Logs per page in Logs panel (pagination). */
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
  readonly integrationsAdbLogcat: IntegrationAdbLogcatConfig;
  /** Optional merged session artifact (Phase 4): `basename.unified.jsonl` next to main log. */
  readonly integrationsUnifiedLog: IntegrationUnifiedLogConfig;
  readonly integrationsFlutterCrashLogs: IntegrationFlutterCrashLogsConfig;
  readonly projectIndex: ProjectIndexConfig;
  readonly replay: ReplayConfig;
  /** Auto-group related log files into logical Sessions (see SessionGroupsConfig). */
  readonly sessionGroups: SessionGroupsConfig;
}

/** Bundled error-classification settings pushed to each viewer target. */
export interface ErrorClassificationSettings {
  readonly suppressTransientErrors: boolean;
  readonly breakOnCritical: boolean;
  readonly levelDetection: string;
  readonly stderrTreatAsError: boolean;
  readonly severityKeywords: SeverityKeywords;
}

/** Error rate chart config pushed to the webview via `setErrorRateConfig`. */
export interface ErrorRateConfig {
  readonly bucketSize: 'auto' | '10s' | '30s' | '1m' | '5m';
  readonly showWarnings: boolean;
  readonly detectSpikes: boolean;
}

/** Sub-toggles when `viewerDbSignalsEnabled` is true (baked into webview + postMessage updates). */
export interface ViewerDbDetectorToggles {
  readonly nPlusOneEnabled: boolean;
  readonly slowBurstEnabled: boolean;
  readonly baselineHintsEnabled: boolean;
  readonly timestampBurstEnabled: boolean;
}

/**
 * Auto-group related log files captured in the same time window into one logical Session.
 * See bugs/auto-group-related-sessions.md for the full behaviour spec.
 */
export interface SessionGroupsConfig {
  /** Master switch. When false, every log file stands alone as before this feature existed. */
  readonly enabled: boolean;
  /** Seconds BEFORE the debug-session start during which pre-existing ungrouped files are claimed. Range 0..600. */
  readonly beforeSeconds: number;
  /** Seconds AFTER the debug-session end during which late-written files (sidecars etc.) are still claimed into the group. Range 0..600. */
  readonly afterSeconds: number;
}

/** Session replay defaults (loaded log playback with optional timing). */
export interface ReplayConfig {
  readonly defaultMode: 'timed' | 'fast';
  readonly defaultSpeed: number;
  readonly minLineDelayMs: number;
  readonly maxDelayMs: number;
}

export type {
  BuildCiSource,
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
  IntegrationFlutterCrashLogsConfig,
} from "./config-types-integrations";

export type {
  ProjectIndexSourceConfig,
  ProjectIndexConfig,
} from "./config-types-project-index";

