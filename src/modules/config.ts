import * as vscode from "vscode";
import * as path from "path";
import { SplitRules, defaultSplitRules } from "./file-splitter";
import { AutoTagRule } from "./auto-tagger";
import { HighlightRule } from "./highlight-rules";

/** Watch pattern entry from user settings. */
export interface WatchPatternSetting {
  readonly keyword: string;
  readonly alert?: "flash" | "badge" | "none";
}

export interface SaropaLogCaptureConfig {
  readonly enabled: boolean;
  readonly categories: readonly string[];
  readonly maxLines: number;
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
  /** How aggressively to classify lines as errors: strict requires structural context, loose matches keywords anywhere. */
  readonly levelDetection: "strict" | "loose";
  /** Log all raw DAP protocol messages (requests, responses, events) to the log file. */
  readonly verboseDap: boolean;
  /** File extensions to include when listing sessions in the reports directory. */
  readonly fileTypes: readonly string[];
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
  ];
}

export function getConfig(): SaropaLogCaptureConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: cfg.get<boolean>("enabled", true),
    categories: cfg.get<string[]>("categories", [
      "console",
      "stdout",
      "stderr",
    ]),
    maxLines: cfg.get<number>("maxLines", 100000),
    includeTimestamp: cfg.get<boolean>("includeTimestamp", true),
    format: cfg.get<"plaintext" | "html">("format", "plaintext"),
    logDirectory: cfg.get<string>("logDirectory", "reports"),
    autoOpen: cfg.get<boolean>("autoOpen", false),
    maxLogFiles: cfg.get<number>("maxLogFiles", 10),
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
    captureAll: cfg.get<boolean>("captureAll", false),
    filterContextLines: cfg.get<number>("filterContextLines", 3),
    contextViewLines: cfg.get<number>("contextViewLines", 10),
    suppressTransientErrors: cfg.get<boolean>("suppressTransientErrors", false),
    breakOnCritical: cfg.get<boolean>("breakOnCritical", false),
    levelDetection: cfg.get<string>("levelDetection", "strict") as "strict" | "loose",
    verboseDap: cfg.get<boolean>("verboseDap", false),
    fileTypes: cfg.get<string[]>("fileTypes", [
      ".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html",
    ]),
  };
}

function parseSplitRules(raw: Record<string, unknown>): SplitRules {
  const defaults = defaultSplitRules();
  return {
    maxLines:
      typeof raw.maxLines === "number" ? raw.maxLines : defaults.maxLines,
    maxSizeKB:
      typeof raw.maxSizeKB === "number" ? raw.maxSizeKB : defaults.maxSizeKB,
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.filter((k) => typeof k === "string")
      : defaults.keywords,
    maxDurationMinutes:
      typeof raw.maxDurationMinutes === "number"
        ? raw.maxDurationMinutes
        : defaults.maxDurationMinutes,
    silenceMinutes:
      typeof raw.silenceMinutes === "number"
        ? raw.silenceMinutes
        : defaults.silenceMinutes,
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

/** Check if a filename matches any tracked file type. Excludes .meta.json sidecars and dotfiles. */
export function isTrackedFile(name: string, fileTypes: readonly string[]): boolean {
  if (name.endsWith('.meta.json') || name.startsWith('.')) { return false; }
  return fileTypes.some(ext => name.endsWith(ext));
}

/** Build a glob pattern for file watchers, e.g. "*.{log,txt,md}". */
export function getFileTypeGlob(fileTypes: readonly string[]): string {
  const exts = fileTypes.map(e => e.replace(/^\./, ''));
  return exts.length === 1 ? `*.${exts[0]}` : `*.{${exts.join(',')}}`;
}

/** Returns true if the env var name matches any pattern. Supports * wildcards (glob-style, case-insensitive). */
export function shouldRedactEnvVar(
  name: string,
  patterns: readonly string[],
): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      "^" +
        pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
        "$",
      "i",
    );
    if (regex.test(name)) {
      return true;
    }
  }
  return false;
}
