/**
 * DB_12: Drift-oriented static search patterns from normalized SQL fingerprints.
 * Mapping rows drive extra indexer tokens (broadened recall) and line-level hints; suggestive only.
 */

import { extractDriftFingerprintSearchTokens } from "./drift-sql-fingerprint-code-tokens";

/** One shape rule: when the fingerprint matches, add indexer tokens and optional path globs. */
export interface DriftStaticOrmPatternRow {
  readonly id: string;
  /** Every keyword must appear as a whole word in the lowercased fingerprint. */
  readonly fingerprintWordsAll: readonly string[];
  /** Lowercase tokens merged into the project-index query list (deduped, capped). */
  readonly extraIndexerTokens: readonly string[];
  /**
   * Optional globs: indexed file must match at least one (OR). Typical patterns mirror VS Code workspace globs for Dart or Kotlin sources.
   * Omitted or empty → row does not contribute globs (union comes from other rows or default).
   */
  readonly optionalPathGlobPatterns?: readonly string[];
  /** Short rationale for maintainers / tests. */
  readonly rationale: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `word` appears as a whole word in the fingerprint (lowercased SQL). */
export function fingerprintHasWord(fingerprintLower: string, word: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(word.toLowerCase())}\\b`);
  return re.test(fingerprintLower);
}

/**
 * Ordered rules: first matching rows contribute extra tokens and line hints (later rows may still add hints if matched).
 * Tokens from all matching rows are merged.
 */
const DART_SOURCES_GLOB = "**/*.dart" as const;

export const DRIFT_STATIC_ORM_PATTERN_ROWS: readonly DriftStaticOrmPatternRow[] = [
  {
    id: "drift-insert",
    fingerprintWordsAll: ["insert"],
    extraIndexerTokens: ["companion", "into"],
    optionalPathGlobPatterns: [DART_SOURCES_GLOB],
    rationale: "Drift inserts often use generated Companion classes and insert/insertAll APIs.",
  },
  {
    id: "drift-update",
    fingerprintWordsAll: ["update"],
    extraIndexerTokens: ["companion", "update"],
    optionalPathGlobPatterns: [DART_SOURCES_GLOB],
    rationale: "Drift updates frequently reference Companion builders and update calls.",
  },
  {
    id: "drift-delete",
    fingerprintWordsAll: ["delete"],
    extraIndexerTokens: ["delete"],
    optionalPathGlobPatterns: [DART_SOURCES_GLOB],
    rationale: "Delete-shaped SQL aligns with delete/deleteWhere in query code.",
  },
  {
    id: "drift-select-join",
    fingerprintWordsAll: ["select", "join"],
    extraIndexerTokens: ["innerjoin", "leftjoin"],
    optionalPathGlobPatterns: [DART_SOURCES_GLOB],
    rationale: "Joined selects often map to Drift join/innerJoin in Dart.",
  },
  {
    id: "drift-select-read",
    fingerprintWordsAll: ["select"],
    extraIndexerTokens: ["watch", "getsingle"],
    optionalPathGlobPatterns: [DART_SOURCES_GLOB],
    rationale: "Select-shaped SQL often appears near watch/get/read query APIs.",
  },
];

const MAX_INDEXER_TOKENS = 20;

/** `snake_case` or plain table token → likely Dart table class name(s). */
export function tableTokenToDartClassHints(tableToken: string): string[] {
  const t = tableToken.trim();
  if (!t) {
    return [];
  }
  const parts = t.split("_").filter(Boolean);
  const pascal = parts.map((p) => (p.length ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "")).join("");
  if (!pascal) {
    return [];
  }
  return [pascal];
}

export interface DriftStaticSqlSearchPlan {
  /** Lowercase tokens for `queryDocEntriesByTokensWithScores`. */
  readonly indexerTokens: readonly string[];
  /** First high-signal table-like token from the fingerprint, lowercase. */
  readonly primaryTableToken: string | undefined;
  /** PascalCase / table hints for line boosting. */
  readonly dartClassHints: readonly string[];
  /** Union of globs from matched mapping rows; files must match at least one (OR). Default includes the standard recursive Dart glob constant. */
  readonly pathGlobPatterns: readonly string[];
}

/**
 * Match workspace-relative paths (forward slashes) against a small glob subset.
 * Supports recursive any-depth suffix patterns (see regex in implementation) and directory-prefix patterns ending in slash-double-star after normalization.
 */
export function pathMatchesStaticSqlGlob(relativePath: string, pattern: string): boolean {
  const norm = relativePath.replace(/\\/g, "/").toLowerCase();
  const pat = pattern.trim().toLowerCase();
  const starExt = /^\*\*\/\*\.([a-z0-9]+)$/.exec(pat);
  if (starExt) {
    return norm.endsWith(`.${starExt[1]}`);
  }
  if (pat.endsWith("/**")) {
    const prefix = pat.slice(0, -3);
    return norm === prefix || norm.startsWith(`${prefix}/`);
  }
  return true;
}

export function pathMatchesAnyStaticSqlGlob(relativePath: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) {
    return true;
  }
  return patterns.some((p) => pathMatchesStaticSqlGlob(relativePath, p));
}

function mergeDedupeLower(tokens: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    const x = raw.toLowerCase().trim();
    if (!x || x.length < 2 || seen.has(x)) {
      continue;
    }
    seen.add(x);
    out.push(x);
    if (out.length >= cap) {
      break;
    }
  }
  return out;
}

/**
 * Build indexer tokens, primary table token, and Drift class / line hints for static source search.
 */
export function buildDriftStaticSqlSearchPlan(fingerprint: string): DriftStaticSqlSearchPlan {
  const fpLower = (fingerprint || "").toLowerCase();
  const base = extractDriftFingerprintSearchTokens(fingerprint);
  const primaryTableToken = base[0];
  const dartClassHints = primaryTableToken ? tableTokenToDartClassHints(primaryTableToken) : [];

  const extra: string[] = [];
  const globSet = new Set<string>();
  for (const row of DRIFT_STATIC_ORM_PATTERN_ROWS) {
    if (!row.fingerprintWordsAll.every((w) => fingerprintHasWord(fpLower, w))) {
      continue;
    }
    extra.push(...row.extraIndexerTokens);
    for (const g of row.optionalPathGlobPatterns ?? []) {
      const gg = g.trim();
      if (gg) { globSet.add(gg); }
    }
  }

  const indexerTokens = mergeDedupeLower([...base, ...extra], MAX_INDEXER_TOKENS);
  let pathGlobPatterns = [...globSet];
  if (pathGlobPatterns.length === 0) {
    pathGlobPatterns = [DART_SOURCES_GLOB];
  }

  return {
    indexerTokens,
    primaryTableToken,
    dartClassHints,
    pathGlobPatterns,
  };
}
