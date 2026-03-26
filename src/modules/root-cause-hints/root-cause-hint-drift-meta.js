"use strict";
/**
 * Extract Drift Advisor issue counts from session metadata for DB_14 root-cause hints.
 * Mirrors `issuesSummary` shape from `drift-advisor-snapshot-map.ts`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rootCauseDriftSummaryFromSessionIntegrations = rootCauseDriftSummaryFromSessionIntegrations;
const drift_advisor_constants_1 = require("../integrations/drift-advisor-constants");
function num(v, d = 0) {
    return typeof v === "number" && Number.isFinite(v) ? v : d;
}
/** Pick rule id with highest count from `byCode` for hypothesis copy. */
function topRuleIdFromByCode(byCode) {
    if (!byCode || typeof byCode !== "object" || Array.isArray(byCode)) {
        return undefined;
    }
    let bestK;
    let bestN = 0;
    for (const [k, v] of Object.entries(byCode)) {
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
function rootCauseDriftSummaryFromSessionIntegrations(integrations) {
    if (!integrations || typeof integrations !== "object") {
        return undefined;
    }
    const raw = integrations[drift_advisor_constants_1.DRIFT_ADVISOR_META_KEY];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const issues = raw.issuesSummary;
    if (!issues || typeof issues !== "object" || Array.isArray(issues)) {
        return undefined;
    }
    const ir = issues;
    const issueCount = num(ir.count, 0);
    if (issueCount <= 0) {
        return undefined;
    }
    const topRuleId = topRuleIdFromByCode(ir.byCode);
    return topRuleId ? { issueCount, topRuleId } : { issueCount };
}
//# sourceMappingURL=root-cause-hint-drift-meta.js.map