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
  /** If true, capture all output (no filtering). */
  readonly captureAll: boolean;
}

const SECTION = "saropaLogCapture";

/**
 * Default highlight rules for common log patterns.
 * These provide sensible coloring out of the box while being easily overridable.
 */
function defaultHighlightRules(): HighlightRule[] {
  return [
    {
      pattern: "/\\b(error|exception|fail(ed|ure)?|fatal)\\b/i",
      color: "var(--vscode-errorForeground)",
      label: "Error",
    },
    {
      pattern: "/\\b(warn(ing)?|caution)\\b/i",
      color: "var(--vscode-editorWarning-foreground)",
      label: "Warning",
    },
    {
      pattern: "/\\b(success|passed|ok)\\b/i",
      color: "var(--vscode-debugConsole-sourceForeground)",
      label: "Success",
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

/**
 * Returns true if the env var name matches any pattern in redactEnvVars.
 * Supports * wildcards (glob-style, case-insensitive).
 */
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
