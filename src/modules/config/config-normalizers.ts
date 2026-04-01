import type { HighlightRule } from "../storage/highlight-rules";
import type { AutoTagRule } from "../misc/auto-tagger";
import type { WatchPatternSetting } from "./config-types";

import { defaultHighlightRules } from "./config-default-highlight-rules";

export const DEFAULT_CATEGORIES = ["console", "stdout", "stderr"];
export const DEFAULT_FILE_TYPES = [".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html"];

export const DEFAULT_WATCH_PATTERNS: WatchPatternSetting[] = [
  { keyword: "error", alert: "flash" },
  { keyword: "exception", alert: "badge" },
  { keyword: "warning", alert: "badge" },
];

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

export function normalizeWatchPatterns(raw: unknown): WatchPatternSetting[] {
  if (!Array.isArray(raw)) { return DEFAULT_WATCH_PATTERNS; }
  const alertValues = ["flash", "badge", "none"] as const;
  const out: WatchPatternSetting[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") { continue; }
    const o = item as Record<string, unknown>;
    const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
    if (!keyword) { continue; }
    const alert: "flash" | "badge" | "none" =
      typeof o.alert === "string" && alertValues.includes(o.alert as typeof alertValues[number])
        ? (o.alert as "flash" | "badge" | "none")
        : "badge";
    out.push({ keyword, alert });
  }

  return out.length > 0 ? out : DEFAULT_WATCH_PATTERNS;
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

export function normalizeHighlightRules(raw: unknown): HighlightRule[] {
  if (!Array.isArray(raw)) { return defaultHighlightRules(); }
  const out: HighlightRule[] = [];
  for (const item of raw) {
    const rule = normalizeHighlightRuleItem(item);
    if (rule) { out.push(rule); }
  }
  return out.length > 0 ? out : defaultHighlightRules();
}

export function normalizeAutoTagRules(raw: unknown): AutoTagRule[] {
  if (!Array.isArray(raw)) { return []; }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") { return null; }
      const o = item as Record<string, unknown>;
      const pattern = typeof o.pattern === "string" ? o.pattern.trim() : "";
      const tag = typeof o.tag === "string" ? o.tag.trim() : "";
      if (!pattern || !tag) { return null; }
      return { pattern, tag };
    })
    .filter((r): r is AutoTagRule => r !== null);
}

