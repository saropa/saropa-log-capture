/**
 * Extract Drift Advisor issue counts from session metadata for DB_14 root-cause hints.
 * Mirrors `issuesSummary` shape from `drift-advisor-snapshot-map.ts`.
 */

import { DRIFT_ADVISOR_META_KEY } from "../integrations/drift-advisor-constants";
import type { RootCauseDriftAdvisorSummary } from "./root-cause-hint-types";

function num(v: unknown, d = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

/** Pick rule id with highest count from `byCode` for hypothesis copy. */
function topRuleIdFromByCode(byCode: unknown): string | undefined {
  if (!byCode || typeof byCode !== "object" || Array.isArray(byCode)) {
    return undefined;
  }
  let bestK: string | undefined;
  let bestN = 0;
  for (const [k, v] of Object.entries(byCode as Record<string, unknown>)) {
    const n = num(v, 0);
    if (n > bestN) {
      bestN = n;
      bestK = k;
    }
  }
  return bestK;
}

/**
 * Build a compact summary for the webview bundle from `meta.integrations`.
 * Returns undefined when Drift Advisor meta is missing or has no issue count.
 */
export function rootCauseDriftSummaryFromSessionIntegrations(
  integrations: Record<string, unknown> | undefined | null,
): RootCauseDriftAdvisorSummary | undefined {
  if (!integrations || typeof integrations !== "object") {
    return undefined;
  }
  const raw = integrations[DRIFT_ADVISOR_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const issues = (raw as Record<string, unknown>).issuesSummary;
  if (!issues || typeof issues !== "object" || Array.isArray(issues)) {
    return undefined;
  }
  const ir = issues as Record<string, unknown>;
  const issueCount = num(ir.count, 0);
  if (issueCount <= 0) {
    return undefined;
  }
  const topRuleId = topRuleIdFromByCode(ir.byCode);
  return topRuleId ? { issueCount, topRuleId } : { issueCount };
}
