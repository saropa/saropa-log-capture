/**
 * Health score computation for bug reports.
 *
 * Ported from saropa_lints/extension/src/healthScore.ts.
 * IMPORTANT: Constants must match that file exactly.
 * Last synced: 2026-03-15 (IMPACT_WEIGHTS, DECAY_RATE = 0.3).
 */

/** Impact weights — must match saropa_lints healthScore.ts exactly. */
const impactWeights: Record<string, number> = {
    critical: 8, high: 3, medium: 1, low: 0.25, opinionated: 0.05,
};

const decayRate = 0.3;

/** Result of a health score computation. */
export interface HealthScore {
    readonly score: number;
    readonly weightedViolations: number;
}

/** Compute health score from violations.json summary data. */
export function computeHealthScore(
    byImpact: Record<string, number>,
    filesAnalyzed: number,
): HealthScore | undefined {
    if (filesAnalyzed === 0) { return undefined; }
    let weighted = 0;
    for (const [key, weight] of Object.entries(impactWeights)) {
        const count = byImpact[key];
        if (typeof count === 'number' && Number.isFinite(count)) {
            weighted += count * weight;
        }
    }
    const density = weighted / filesAnalyzed;
    const raw = Math.round(100 * Math.exp(-density * decayRate));
    const score = Number.isFinite(raw) ? raw : 0;
    return { score, weightedViolations: weighted };
}

/** Format the one-liner for bug report header. */
export function formatHealthScoreLine(
    byImpact: Record<string, number>,
    filesAnalyzed: number,
    tier: string,
    totalViolations: number,
): string | undefined {
    const health = computeHealthScore(byImpact, filesAnalyzed);
    if (!health) { return undefined; }
    return `**Project health: ${health.score}/100** (${tier} tier, ${totalViolations} violations)`;
}

/** Format the per-impact breakdown for the lint section (no score prefix). */
export function formatHealthScoreBreakdown(
    byImpact: Record<string, number>,
): string | undefined {
    const keys = ['critical', 'high', 'medium', 'low', 'opinionated'];
    const parts: string[] = [];
    for (const key of keys) {
        const count = byImpact[key] ?? 0;
        if (count > 0) { parts.push(`${count} ${key}`); }
    }
    return parts.length > 0 ? parts.join(', ') : undefined;
}
