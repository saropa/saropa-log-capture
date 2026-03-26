"use strict";
/**
 * Health score computation for bug reports.
 *
 * When the Saropa Lints extension is installed and exposes getHealthScoreParams(),
 * those values are used; otherwise built-in constants (must match
 * saropa_lints/extension/src/healthScore.ts). Last synced: 2026-03-15.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthScoreParams = getHealthScoreParams;
exports.parseConsumerContractHealthScoreParams = parseConsumerContractHealthScoreParams;
exports.getHealthScoreParamsForWorkspace = getHealthScoreParamsForWorkspace;
exports.computeHealthScore = computeHealthScore;
exports.formatHealthScoreLine = formatHealthScoreLine;
exports.formatHealthScoreBreakdown = formatHealthScoreBreakdown;
const vscode = __importStar(require("vscode"));
const saropa_lints_api_1 = require("./saropa-lints-api");
/** Impact weights — fallback when extension API not available. Must match saropa_lints healthScore.ts. */
const BUILT_IN_IMPACT_WEIGHTS = {
    critical: 8, high: 3, medium: 1, low: 0.25, opinionated: 0.05,
};
const BUILT_IN_DECAY_RATE = 0.3;
/** Get health score params from Saropa Lints extension API when present, else built-in. */
function getHealthScoreParams() {
    const ext = vscode.extensions.getExtension(saropa_lints_api_1.SAROPA_LINTS_EXTENSION_ID);
    const params = ext?.exports?.getHealthScoreParams?.();
    if (params && typeof params.decayRate === 'number' && params.impactWeights && typeof params.impactWeights === 'object') {
        return { impactWeights: params.impactWeights, decayRate: params.decayRate };
    }
    return { impactWeights: BUILT_IN_IMPACT_WEIGHTS, decayRate: BUILT_IN_DECAY_RATE };
}
function parseHealthScoreParams(obj) {
    if (!obj || typeof obj !== 'object') {
        return undefined;
    }
    const h = obj;
    const impactWeightsRaw = h.impactWeights;
    const decayRateRaw = h.decayRate;
    if (typeof decayRateRaw !== 'number' || !Number.isFinite(decayRateRaw)) {
        return undefined;
    }
    if (!impactWeightsRaw || typeof impactWeightsRaw !== 'object') {
        return undefined;
    }
    const impactWeightsObj = impactWeightsRaw;
    const impactWeights = {};
    for (const [key, value] of Object.entries(impactWeightsObj)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            impactWeights[key] = value;
        }
    }
    if (Object.keys(impactWeights).length === 0) {
        return undefined;
    }
    return { impactWeights, decayRate: decayRateRaw };
}
/**
 * Parse `reports/.saropa_lints/consumer_contract.json` (best-effort).
 *
 * Used by bug report health score so the file contract is the single source
 * of truth when the Saropa Lints extension API is unavailable.
 */
function parseConsumerContractHealthScoreParams(json) {
    if (!json || typeof json !== 'object') {
        return undefined;
    }
    const contract = json;
    return parseHealthScoreParams(contract.healthScore);
}
/**
 * Prefer consumer manifest (`consumer_contract.json`) for health score params.
 * Fallback: Saropa Lints extension API when available; else built-in constants.
 */
async function getHealthScoreParamsForWorkspace(wsRoot) {
    // consumer_contract.json is additive; missing/invalid files must not break bug report generation.
    const uri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'consumer_contract.json');
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const fromFile = parseConsumerContractHealthScoreParams(parsed);
        if (fromFile) {
            return fromFile;
        }
    }
    catch {
        /* fall back */
    }
    return getHealthScoreParams();
}
/** Compute health score from violations.json summary data. Uses params when given, else built-in. */
function computeHealthScore(byImpact, filesAnalyzed, params) {
    if (filesAnalyzed === 0) {
        return undefined;
    }
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
/** Format the one-liner for bug report header. */
function formatHealthScoreLine(input) {
    const health = computeHealthScore(input.byImpact, input.filesAnalyzed, input.params ?? getHealthScoreParams());
    if (!health) {
        return undefined;
    }
    return `**Project health: ${health.score}/100** (${input.tier} tier, ${input.totalViolations} violations)`;
}
/** Format the per-impact breakdown for the lint section (no score prefix). */
function formatHealthScoreBreakdown(byImpact) {
    const keys = ['critical', 'high', 'medium', 'low', 'opinionated'];
    const parts = [];
    for (const key of keys) {
        const count = byImpact[key] ?? 0;
        if (count > 0) {
            parts.push(`${count} ${key}`);
        }
    }
    return parts.length > 0 ? parts.join(', ') : undefined;
}
//# sourceMappingURL=health-score.js.map