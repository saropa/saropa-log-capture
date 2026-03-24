/**
 * DB_12: Rank indexed doc hits for “possible static sources” using file content + Drift heuristics.
 * `vscode` is loaded only inside async I/O paths so pure scoring helpers stay testable under `node:test`.
 */

import type { DocIndexEntry } from "../project-indexer/project-indexer-types";
import type { RankedDocEntry } from "../project-indexer/project-indexer-ranking";
import { pathMatchesAnyStaticSqlGlob, type DriftStaticSqlSearchPlan } from "./drift-sql-static-orm-patterns";

export interface StaticSqlFileScore {
  readonly bestLine1Based: number;
  /** Line contains primary table token or a Dart table class hint. */
  readonly lineHasPrimaryTableShape: boolean;
  /** Distinct indexer tokens matched on the best-scoring line. */
  readonly bestLineTokenHits: number;
}

export const STATIC_SQL_MAX_FILES_TO_SCAN = 48;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary match for lowercase token in a line (lineLower aligns with token case). */
function lineHasWord(lineLower: string, tokenLower: string): boolean {
  if (tokenLower.length < 2) {
    return false;
  }
  const re = new RegExp(`\\b${escapeRegExp(tokenLower)}\\b`);
  return re.test(lineLower);
}

/**
 * True if the line likely references the table as a Dart identifier or SQL-like token.
 */
export function lineMatchesPrimaryTableShape(line: string, plan: DriftStaticSqlSearchPlan): boolean {
  const primary = plan.primaryTableToken;
  if (primary && lineHasWord(line.toLowerCase(), primary)) {
    return true;
  }
  for (const hint of plan.dartClassHints) {
    if (hint.length >= 2) {
      const re = new RegExp(`\\b${escapeRegExp(hint)}\\b`);
      if (re.test(line)) {
        return true;
      }
    }
  }
  return false;
}

/** Score each line; pick the strongest line by DB_12 rules. Exported for unit tests. */
export function scoreFileContentForStaticSql(plan: DriftStaticSqlSearchPlan, content: string): StaticSqlFileScore {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) {
    return { bestLine1Based: 1, lineHasPrimaryTableShape: false, bestLineTokenHits: 0 };
  }
  let bestLine1Based = 1;
  let lineHasPrimaryTableShape = false;
  let bestLineTokenHits = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    let hits = 0;
    for (const t of plan.indexerTokens) {
      if (lineHasWord(lower, t)) {
        hits++;
      }
    }
    const hasTable = lineMatchesPrimaryTableShape(line, plan);
    const idx0 = i;
    const prevIdx0 = bestLine1Based - 1;
    const beats =
      Number(hasTable) > Number(lineHasPrimaryTableShape)
      || (hasTable === lineHasPrimaryTableShape && hits > bestLineTokenHits)
      || (hasTable === lineHasPrimaryTableShape && hits === bestLineTokenHits && idx0 < prevIdx0);
    if (beats) {
      bestLine1Based = i + 1;
      lineHasPrimaryTableShape = hasTable;
      bestLineTokenHits = hits;
    }
  }

  return { bestLine1Based, lineHasPrimaryTableShape, bestLineTokenHits };
}

export interface EnrichedStaticSqlCandidate {
  readonly doc: DocIndexEntry;
  readonly indexerScore: number;
  readonly bestLine1Based: number;
  readonly lineHasPrimaryTableShape: boolean;
  readonly bestLineTokenHits: number;
  readonly isDartFile: boolean;
}

export function filterRankedDocsByStaticSqlPathGlobs(
  ranked: readonly RankedDocEntry[],
  patterns: readonly string[],
): RankedDocEntry[] {
  if (!patterns.length) {
    return [...ranked];
  }
  return ranked.filter((r) => pathMatchesAnyStaticSqlGlob(r.doc.relativePath, patterns));
}

function compareCandidates(a: EnrichedStaticSqlCandidate, b: EnrichedStaticSqlCandidate): number {
  if (a.lineHasPrimaryTableShape !== b.lineHasPrimaryTableShape) {
    return a.lineHasPrimaryTableShape ? -1 : 1;
  }
  if (a.bestLineTokenHits !== b.bestLineTokenHits) {
    return b.bestLineTokenHits - a.bestLineTokenHits;
  }
  if (a.indexerScore !== b.indexerScore) {
    return b.indexerScore - a.indexerScore;
  }
  if (a.isDartFile !== b.isDartFile) {
    return a.isDartFile ? -1 : 1;
  }
  return a.doc.relativePath.localeCompare(b.doc.relativePath);
}

/**
 * Re-rank indexer hits using per-file line scans (best line + table shape + token density).
 */
export async function enrichRankedDocsForStaticSql(
  plan: DriftStaticSqlSearchPlan,
  ranked: readonly RankedDocEntry[],
): Promise<EnrichedStaticSqlCandidate[]> {
  const vscode = await import("vscode");
  const filtered = filterRankedDocsByStaticSqlPathGlobs(ranked, plan.pathGlobPatterns);
  const slice = filtered.slice(0, STATIC_SQL_MAX_FILES_TO_SCAN);
  const enriched: EnrichedStaticSqlCandidate[] = [];

  for (const r of slice) {
    const isDartFile = r.doc.relativePath.toLowerCase().endsWith(".dart");
    let score: StaticSqlFileScore = { bestLine1Based: 1, lineHasPrimaryTableShape: false, bestLineTokenHits: 0 };
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.parse(r.doc.uri));
      const text = Buffer.from(raw).toString("utf-8");
      score = scoreFileContentForStaticSql(plan, text);
    } catch {
      /* keep defaults: still list file, open at start */
    }
    enriched.push({
      doc: r.doc,
      indexerScore: r.score,
      bestLine1Based: score.bestLine1Based,
      lineHasPrimaryTableShape: score.lineHasPrimaryTableShape,
      bestLineTokenHits: score.bestLineTokenHits,
      isDartFile,
    });
  }

  enriched.sort(compareCandidates);
  return enriched;
}

/**
 * Same ranking as the host QuickPick, but with in-memory file contents (tests / fixtures).
 * Keys of `contentsByRelativePath` should use forward slashes.
 */
export function buildEnrichedStaticSqlPickListSync(
  plan: DriftStaticSqlSearchPlan,
  ranked: readonly RankedDocEntry[],
  contentsByRelativePath: ReadonlyMap<string, string>,
  maxPick: number,
): EnrichedStaticSqlCandidate[] {
  const filtered = filterRankedDocsByStaticSqlPathGlobs(ranked, plan.pathGlobPatterns);
  const headSlice = filtered.slice(0, STATIC_SQL_MAX_FILES_TO_SCAN);
  const head: EnrichedStaticSqlCandidate[] = headSlice.map((r) => {
    const rel = r.doc.relativePath.replace(/\\/g, "/");
    const text = contentsByRelativePath.get(rel) ?? "";
    const score = scoreFileContentForStaticSql(plan, text);
    const isDartFile = r.doc.relativePath.toLowerCase().endsWith(".dart");
    return {
      doc: r.doc,
      indexerScore: r.score,
      bestLine1Based: score.bestLine1Based,
      lineHasPrimaryTableShape: score.lineHasPrimaryTableShape,
      bestLineTokenHits: score.bestLineTokenHits,
      isDartFile,
    };
  });
  head.sort(compareCandidates);
  const tail: EnrichedStaticSqlCandidate[] = filtered.slice(STATIC_SQL_MAX_FILES_TO_SCAN).map((r) => ({
    doc: r.doc,
    indexerScore: r.score,
    bestLine1Based: 1,
    lineHasPrimaryTableShape: false,
    bestLineTokenHits: 0,
    isDartFile: r.doc.relativePath.toLowerCase().endsWith(".dart"),
  }));
  const merged = [...head, ...tail];
  merged.sort(compareCandidates);
  return merged.slice(0, maxPick);
}

/** Merge line-scanned head with remaining indexer hits; sort; cap for QuickPick. */
export async function buildEnrichedStaticSqlPickList(
  plan: DriftStaticSqlSearchPlan,
  ranked: readonly RankedDocEntry[],
  maxPick: number,
): Promise<EnrichedStaticSqlCandidate[]> {
  const head = await enrichRankedDocsForStaticSql(plan, ranked);
  const filtered = filterRankedDocsByStaticSqlPathGlobs(ranked, plan.pathGlobPatterns);
  const tail: EnrichedStaticSqlCandidate[] = filtered.slice(STATIC_SQL_MAX_FILES_TO_SCAN).map((r) => ({
    doc: r.doc,
    indexerScore: r.score,
    bestLine1Based: 1,
    lineHasPrimaryTableShape: false,
    bestLineTokenHits: 0,
    isDartFile: r.doc.relativePath.toLowerCase().endsWith(".dart"),
  }));
  const merged = [...head, ...tail];
  merged.sort(compareCandidates);
  return merged.slice(0, maxPick);
}
