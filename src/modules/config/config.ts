/**
 * Saropa Log Capture configuration — single source of truth for all extension settings.
 *
 * Reads from VS Code workspace/global config (section "saropaLogCapture"), applies
 * defaults, and exposes a typed SaropaLogCaptureConfig. Call getConfig() when you need
 * current values; config is not cached across settings changes.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import { parseSplitRules } from "../misc/file-splitter";
import { getIntegrationConfig, getProjectIndexConfig } from "./integration-config";
import type { HighlightRule } from "../storage/highlight-rules";
import type { AutoTagRule } from "../misc/auto-tagger";
import { defaultHighlightRules, type SaropaLogCaptureConfig, type WatchPatternSetting } from "./config-types";
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
  IntegrationUnifiedLogConfig,
  ProjectIndexSourceConfig,
  ProjectIndexConfig,
} from "./config-types";

const SECTION = "saropaLogCapture";

const DEFAULT_CATEGORIES = ["console", "stdout", "stderr"];
const DEFAULT_FILE_TYPES = [".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html"];
const DEFAULT_WATCH_PATTERNS: WatchPatternSetting[] = [
  { keyword: "error", alert: "flash" },
  { keyword: "exception", alert: "badge" },
  { keyword: "warning", alert: "badge" },
];

function normalizeWatchPatterns(raw: unknown): WatchPatternSetting[] {
  if (!Array.isArray(raw)) {return DEFAULT_WATCH_PATTERNS;}
  const alertValues = ["flash", "badge", "none"] as const;
  const out: WatchPatternSetting[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {continue;}
    const o = item as Record<string, unknown>;
    const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
    if (!keyword) {continue;}
    const alert: "flash" | "badge" | "none" =
      typeof o.alert === "string" && alertValues.includes(o.alert as typeof alertValues[number])
        ? (o.alert as "flash" | "badge" | "none")
        : "badge";
    out.push({ keyword, alert });
  }
  return out.length > 0 ? out : DEFAULT_WATCH_PATTERNS;
}

function asObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") { return undefined; }
  return value as Record<string, unknown>;
}

function readOptionalString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === "string" ? v : undefined;
}

function readOptionalScope(o: Record<string, unknown>): "line" | "keyword" | undefined {
  const v = o.scope;
  if (v === "line") { return "line"; }
  if (v === "keyword") { return "keyword"; }
  return undefined;
}

function readPattern(o: Record<string, unknown>): string | undefined {
  const v = o.pattern;
  if (typeof v !== "string") { return undefined; }
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function readBooleanOrFalse(o: Record<string, unknown>, key: string): boolean {
  const v = o[key];
  return typeof v === "boolean" ? v : false;
}

function normalizeHighlightRuleItem(item: unknown): HighlightRule | undefined {
  const o = asObjectRecord(item);
  if (!o) { return undefined; }
  const pattern = readPattern(o);
  if (!pattern) { return undefined; }
  return {
    pattern,
    color: readOptionalString(o, "color"),
    label: readOptionalString(o, "label"),
    bold: readBooleanOrFalse(o, "bold"),
    italic: readBooleanOrFalse(o, "italic"),
    scope: readOptionalScope(o),
    backgroundColor: readOptionalString(o, "backgroundColor"),
  };
}

function normalizeHighlightRules(raw: unknown): HighlightRule[] {
  if (!Array.isArray(raw)) {return defaultHighlightRules();}
  const out: HighlightRule[] = [];
  for (const item of raw) {
    const rule = normalizeHighlightRuleItem(item);
    if (rule) { out.push(rule); }
  }
  return out.length > 0 ? out : defaultHighlightRules();
}

function normalizeAutoTagRules(raw: unknown): AutoTagRule[] {
  if (!Array.isArray(raw)) {return [];}
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {return null;}
      const o = item as Record<string, unknown>;
      const pattern = typeof o.pattern === "string" ? o.pattern.trim() : "";
      const tag = typeof o.tag === "string" ? o.tag.trim() : "";
      if (!pattern || !tag) {return null;}
      return { pattern, tag };
    })
    .filter((r): r is AutoTagRule => r !== null);
}

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
    showDecorations: ensureBoolean(cfg.get("showDecorations"), true),
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
    minimapWidth: ensureEnum(cfg.get("minimapWidth"), ["small", "medium", "large"], "medium"),
    showScrollbar: ensureBoolean(cfg.get("showScrollbar"), false),
    viewerAlwaysShowSearchMatchOptions: ensureBoolean(cfg.get("viewerAlwaysShowSearchMatchOptions"), false),
    deemphasizeFrameworkLevels: ensureBoolean(cfg.get("deemphasizeFrameworkLevels"), false),
    levelDetection: ensureEnum(cfg.get("levelDetection"), ["strict", "loose"], "strict"),
    smartBookmarks: {
      suggestFirstError: ensureBoolean(cfg.get("smartBookmarks.suggestFirstError"), true),
      suggestFirstWarning: ensureBoolean(cfg.get("smartBookmarks.suggestFirstWarning"), false),
    },
    verboseDap: ensureBoolean(cfg.get("verboseDap"), false),
    diagnosticCapture: ensureBoolean(cfg.get("diagnosticCapture"), false),
    fileTypes: ensureStringArray(cfg.get("fileTypes"), DEFAULT_FILE_TYPES),
    tailPatterns: ensureStringArray(cfg.get("tailPatterns"), ["**/*.log"]),
    docsScanDirs: ensureStringArray(cfg.get("docsScanDirs"), ["bugs", "docs"]),
    includeSubfolders: ensureBoolean(cfg.get("includeSubfolders"), true),
    treeRefreshInterval: ensureNonNegative(cfg.get("treeRefreshInterval"), 0),
    sessionListPageSize: clamp(cfg.get("sessionListPageSize"), 10, 500, 100),
    iconBarPosition: ensureEnum(cfg.get("iconBarPosition"), ["left", "right"], "left"),
    organizeFolders: ensureBoolean(cfg.get("organizeFolders"), true),
    integrationsAdapters: ensureStringArray(cfg.get("integrations.adapters"), ["packages", "performance"]),
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

export { isTrackedFile, readTrackedFiles, getFileTypeGlob, shouldRedactEnvVar } from './config-file-utils';
