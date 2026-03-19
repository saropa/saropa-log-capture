/**
 * Health score computation for bug reports.
 *
 * When the Saropa Lints extension is installed and exposes getHealthScoreParams(),
 * those values are used; otherwise built-in constants (must match
 * saropa_lints/extension/src/healthScore.ts). Last synced: 2026-03-15.
 */

import * as vscode from 'vscode';
import { SAROPA_LINTS_EXTENSION_ID, type SaropaLintsApi } from './saropa-lints-api';

/** Impact weights — fallback when extension API not available. Must match saropa_lints healthScore.ts. */
const BUILT_IN_IMPACT_WEIGHTS: Record<string, number> = {
    critical: 8, high: 3, medium: 1, low: 0.25, opinionated: 0.05,
};

const BUILT_IN_DECAY_RATE = 0.3;

export type HealthScoreParams = { impactWeights: Record<string, number>; decayRate: number };

/** Get health score params from Saropa Lints extension API when present, else built-in. */
export function getHealthScoreParams(): HealthScoreParams {
    const ext = vscode.extensions.getExtension<SaropaLintsApi>(SAROPA_LINTS_EXTENSION_ID);
    const params = ext?.exports?.getHealthScoreParams?.();
    if (params && typeof params.decayRate === 'number' && params.impactWeights && typeof params.impactWeights === 'object') {
        return { impactWeights: params.impactWeights, decayRate: params.decayRate };
    }
    return { impactWeights: BUILT_IN_IMPACT_WEIGHTS, decayRate: BUILT_IN_DECAY_RATE };
}

interface ConsumerContractJsonHealthScore {
    readonly impactWeights?: unknown;
    readonly decayRate?: unknown;
}

interface ConsumerContractJson {
    readonly healthScore?: ConsumerContractJsonHealthScore;
}

function parseHealthScoreParams(obj: unknown): HealthScoreParams | undefined {
    if (!obj || typeof obj !== 'object') { return undefined; }
    const h = obj as ConsumerContractJsonHealthScore;
    const impactWeightsRaw = h.impactWeights;
    const decayRateRaw = h.decayRate;
    if (typeof decayRateRaw !== 'number' || !Number.isFinite(decayRateRaw)) { return undefined; }
    if (!impactWeightsRaw || typeof impactWeightsRaw !== 'object') { return undefined; }
    const impactWeightsObj = impactWeightsRaw as Record<string, unknown>;
    const impactWeights: Record<string, number> = {};
    for (const [key, value] of Object.entries(impactWeightsObj)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            impactWeights[key] = value;
        }
    }
    if (Object.keys(impactWeights).length === 0) { return undefined; }
    return { impactWeights, decayRate: decayRateRaw };
}

/**
 * Parse `reports/.saropa_lints/consumer_contract.json` (best-effort).
 *
 * Used by bug report health score so the file contract is the single source
 * of truth when the Saropa Lints extension API is unavailable.
 */
export function parseConsumerContractHealthScoreParams(json: unknown): HealthScoreParams | undefined {
    if (!json || typeof json !== 'object') { return undefined; }
    const contract = json as ConsumerContractJson;
    return parseHealthScoreParams(contract.healthScore);
}

/**
 * Prefer consumer manifest (`consumer_contract.json`) for health score params.
 * Fallback: Saropa Lints extension API when available; else built-in constants.
 */
export async function getHealthScoreParamsForWorkspace(wsRoot: vscode.Uri): Promise<HealthScoreParams> {
    // consumer_contract.json is additive; missing/invalid files must not break bug report generation.
    const uri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'consumer_contract.json');
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8')) as unknown;
        const fromFile = parseConsumerContractHealthScoreParams(parsed);
        if (fromFile) { return fromFile; }
    } catch {
        /* fall back */
    }
    return getHealthScoreParams();
}

/** Result of a health score computation. */
export interface HealthScore {
    readonly score: number;
    readonly weightedViolations: number;
}

/** Compute health score from violations.json summary data. Uses params when given, else built-in. */
export function computeHealthScore(
    byImpact: Record<string, number>,
    filesAnalyzed: number,
    params?: HealthScoreParams,
): HealthScore | undefined {
    if (filesAnalyzed === 0) { return undefined; }
    const { impactWeights, decayRate } = params ?? getHealthScoreParams();
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

/** Format the one-liner for bug report header. Uses extension API for params when present. */
export interface HealthScoreLineInput {
    readonly byImpact: Record<string, number>;
    readonly filesAnalyzed: number;
    readonly tier: string;
    readonly totalViolations: number;
    /** When provided, used instead of calling extension API / built-in constants. */
    readonly params?: HealthScoreParams;
}

/** Format the one-liner for bug report header. */
export function formatHealthScoreLine(input: HealthScoreLineInput): string | undefined {
    const health = computeHealthScore(
        input.byImpact,
        input.filesAnalyzed,
        input.params ?? getHealthScoreParams(),
    );
    if (!health) { return undefined; }
    return `**Project health: ${health.score}/100** (${input.tier} tier, ${input.totalViolations} violations)`;
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
