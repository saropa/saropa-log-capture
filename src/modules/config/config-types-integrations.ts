export type BuildCiSource = "file" | "github" | "azure" | "gitlab";

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
  readonly source: "file" | "junit";
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
  readonly runtime: "docker" | "podman";
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
  readonly whichTerminals: "all" | "active" | "linked";
  readonly writeSidecar: boolean;
  readonly prefixTimestamp: boolean;
  readonly maxLines: number;
}

export interface IntegrationLinuxLogsConfig {
  readonly when: "wsl" | "remote" | "always";
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
  /** Create a missing log file (and parent dirs) at session start so it can be tailed immediately. */
  readonly createIfMissing: boolean;
  /** Re-tail from the start when the file is rotated (recreated/truncated) or a newer glob match appears. */
  readonly followRotation: boolean;
}

export interface IntegrationSecurityConfig {
  readonly windowsSecurityLog: boolean;
  readonly auditLogPath: string;
  readonly redactSecurityEvents: boolean;
  readonly includeSummaryInHeader: boolean;
  readonly includeInBugReport: boolean;
}

export interface IntegrationDatabaseConfig {
  readonly mode: "parse" | "file" | "api";
  readonly queryLogPath: string;
  readonly requestIdPattern: string;
  readonly queryBlockPattern: string;
  readonly timeWindowSeconds: number;
  readonly maxQueriesPerLookup: number;
  /** When true, replace string/numeric literals in captured SQL with ? before writing the queries sidecar. */
  readonly redactLiterals: boolean;
  /** When true (file mode), tail the query log during the session and stream new queries live into the viewer. */
  readonly liveTail: boolean;
  /** API mode: endpoint that returns queries for a session time range. Token is read from SecretStorage. */
  readonly apiUrl: string;
}

export interface IntegrationHttpConfig {
  readonly requestIdPattern: string;
  readonly requestLogPath: string;
  readonly timeWindowSeconds: number;
  readonly maxRequestsPerSession: number;
}

export interface IntegrationOtelConfig {
  /** Backend deep-link template with a {traceId} placeholder (e.g. Jaeger/Tempo trace URL). */
  readonly traceUrlTemplate: string;
  /** Optional regex override (capture group 1 = trace id) for non-standard trace-id log formats. */
  readonly traceIdPattern: string;
}

export interface IntegrationBrowserConfig {
  readonly mode: "file" | "cdp";
  readonly browserLogPath: string;
  readonly browserLogFormat: "jsonl" | "json";
  readonly maxEvents: number;
  /** Chrome DevTools Protocol WebSocket URL (cdp mode only, e.g. ws://localhost:9222). */
  readonly cdpUrl: string;
  /** Capture network events in addition to console events (cdp mode). */
  readonly includeNetwork: boolean;
  /** Regex to extract a request ID from console messages for correlation. */
  readonly requestIdPattern: string;
}

export interface IntegrationAdbLogcatConfig {
  /**
   * Master allow for the adb logcat feed (default true). When false, logcat never spawns even
   * for a Flutter session. When true, the provider still only runs where it applies (auto-detect
   * on Dart/Flutter sessions, or an explicit `adbLogcat` entry in integrations.adapters). This is
   * the on/off the Options → Integrations checkbox binds to, so an explicit uncheck truly disables
   * capture instead of being silently overridden by auto-detect.
   */
  readonly enabled: boolean;
  /** Device serial (blank = default device). Maps to `adb -s <serial>`. */
  readonly device: string;
  /** Logcat tag filter expressions (e.g. ["flutter:V", "*:S"]). Passed to adb logcat. */
  readonly tagFilters: readonly string[];
  /** Minimum logcat level to capture: V, D, I, W, E, F, A. Default "V" (all). */
  readonly minLevel: string;
  /** When true, filter logcat output by debug target PID once known from DAP. */
  readonly filterByPid: boolean;
  /** Max lines to buffer for sidecar file. */
  readonly maxBufferLines: number;
  /** Write buffered logcat as .logcat.log sidecar file at session end. */
  readonly writeSidecar: boolean;
  /** When true, capture device-other (non-critical, non-Flutter) logcat lines. Default false. */
  readonly captureDeviceOther: boolean;
  /**
   * When true (default), ANR / native-crash evidence is always captured even when level or PID
   * filtering would otherwise drop it. ActivityManager / AndroidRuntime dump the "ANR in <pkg>"
   * header and frozen main-thread stack from system_server — a different PID than the app — so
   * PID scoping (filterByPid) hides exactly the richest ANR detail unless this bypass is on.
   */
  readonly captureAnr: boolean;
}

export interface IntegrationFlutterCrashLogsConfig {
  /** Delete flutter_*.log originals from workspace root after importing to reports. */
  readonly deleteOriginals: boolean;
  /** Minutes before session start to include when scanning for crash logs. */
  readonly leadMinutes: number;
  /** Minutes after session end to include when scanning for crash logs. */
  readonly lagMinutes: number;
}

/** Write `basename.unified.jsonl` merging main log + terminal + external sidecars (Phase 4). */
export interface IntegrationUnifiedLogConfig {
  readonly writeAtSessionEnd: boolean;
  /** Max lines per source (tail); bounds memory and file size. */
  readonly maxLinesPerSource: number;
}

