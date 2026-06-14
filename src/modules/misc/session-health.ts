/**
 * Per-session health score (cross-session-analysis idea #19).
 *
 * Condenses a session's detected signals into a single 0–100 score plus a breakdown of what
 * dragged it down, so a glance at the score (and its trend across sessions) tells the developer
 * whether a session is getting healthier or worse. Higher is better; 100 is a clean session.
 *
 * Pure (no vscode import) so the scoring and its breakdown are unit-testable under `node --test`.
 * The caller supplies already-counted signals; this module owns only the weighting policy.
 */

/** Signal counts that feed the score. All optional — absent means zero. */
export interface SessionHealthInput {
    readonly errors?: number;
    readonly warnings?: number;
    readonly networkFailures?: number;
    readonly memoryEvents?: number;
    readonly slowOperations?: number;
    /** ANR risk score (0 = none); any positive value applies the ANR penalty once. */
    readonly anrScore?: number;
}

/** One contributor to the score, for display ("3 errors: -30"). delta is negative or zero. */
export interface HealthFactor {
    readonly key: string;
    readonly count: number;
    readonly delta: number;
}

export interface SessionHealth {
    /** 0–100, clamped. 100 = no penalising signals. */
    readonly score: number;
    /** Non-zero penalties, ordered most-severe first. Empty when the session is clean. */
    readonly factors: readonly HealthFactor[];
}

/**
 * Per-signal penalty and the maximum total that signal type can subtract. Caps stop a single
 * noisy category (e.g. 200 warnings) from zeroing the score on its own — the intent is a relative
 * health gauge, not an error tally. Errors and ANR weigh heaviest because they map to user-visible
 * failure; warnings and slow ops weigh least.
 */
const WEIGHTS: Record<keyof SessionHealthInput, { readonly per: number; readonly cap: number }> = {
    errors: { per: 10, cap: 50 },
    anrScore: { per: 25, cap: 25 },
    memoryEvents: { per: 8, cap: 24 },
    networkFailures: { per: 5, cap: 15 },
    slowOperations: { per: 3, cap: 12 },
    warnings: { per: 2, cap: 10 },
};

/** Order factors are reported in — most-severe category first. */
const FACTOR_ORDER: readonly (keyof SessionHealthInput)[] = [
    'errors', 'anrScore', 'memoryEvents', 'networkFailures', 'slowOperations', 'warnings',
];

/** ANR is a yes/no penalty (any positive score), so its "count" for weighting is 1. */
function effectiveCount(key: keyof SessionHealthInput, raw: number): number {
    return key === 'anrScore' ? (raw > 0 ? 1 : 0) : raw;
}

/**
 * Compute the health score and the breakdown of penalties. Starts at 100 and subtracts each
 * signal type's capped penalty; the result is clamped to [0, 100].
 */
export function computeSessionHealth(input: SessionHealthInput): SessionHealth {
    const factors: HealthFactor[] = [];
    let score = 100;
    for (const key of FACTOR_ORDER) {
        const raw = input[key] ?? 0;
        const count = effectiveCount(key, raw);
        if (count <= 0) { continue; }
        const w = WEIGHTS[key];
        const delta = -Math.min(count * w.per, w.cap);
        score += delta;
        factors.push({ key, count: raw, delta });
    }
    return { score: Math.max(0, Math.min(100, score)), factors };
}
