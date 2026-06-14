/**
 * Error attention score (cross-session-analysis idea #17).
 *
 * Combines the signals a bug report already gathers into one composite "how much does this error
 * deserve attention" number, so the most actionable errors can be ranked above framework noise.
 * The factors and weights mirror the idea's table: app-code and recently-changed weigh most;
 * framework-only stack traces and well-known SDK errors weigh negative.
 *
 * Pure (no vscode import) so the scoring and factor breakdown are unit-testable under `node --test`.
 * The caller supplies booleans it has already determined; this module owns only the weighting.
 */

/** Signals that raise or lower an error's attention score. All optional — absent means false. */
export interface AttentionFactors {
    /** The error's stack trace includes app code (not just framework frames). */
    readonly inAppCode?: boolean;
    /** A referenced source file / the crash line changed recently. */
    readonly recentlyChanged?: boolean;
    /** The error recurs across multiple sessions. */
    readonly recurring?: boolean;
    /** A FIXME/BUG/HACK annotation sits near the crash site. */
    readonly hasAnnotation?: boolean;
    /** The error is being seen for the first time. */
    readonly firstTimeSeen?: boolean;
    /** The error appears in project documentation. */
    readonly inDocumentation?: boolean;
    /** The stack trace is framework-only (no app frames). */
    readonly frameworkOnly?: boolean;
    /** A common, well-documented SDK error. */
    readonly commonSdkError?: boolean;
}

/** One contributor to the score, for display. */
export interface AttentionContribution {
    readonly key: string;
    readonly weight: number;
}

export interface AttentionScore {
    /** Composite score; clamped to a floor of 0 (negatives net to 0, not below). */
    readonly score: number;
    /** Non-zero contributions, ordered strongest-positive → strongest-negative. */
    readonly contributions: readonly AttentionContribution[];
}

/** Weights mirror the idea's table; ordered so the breakdown reads most-positive first. */
const WEIGHTS: readonly { readonly key: keyof AttentionFactors; readonly label: string; readonly weight: number }[] = [
    { key: 'inAppCode', label: 'in app code', weight: 3 },
    { key: 'recentlyChanged', label: 'recently changed', weight: 3 },
    { key: 'recurring', label: 'recurring across sessions', weight: 2 },
    { key: 'hasAnnotation', label: 'FIXME/BUG annotation nearby', weight: 2 },
    { key: 'firstTimeSeen', label: 'first time seen', weight: 1 },
    { key: 'inDocumentation', label: 'in documentation', weight: 1 },
    { key: 'commonSdkError', label: 'common SDK error', weight: -1 },
    { key: 'frameworkOnly', label: 'framework-only stack', weight: -2 },
];

/**
 * Compute the attention score and its breakdown. Raw sum of the active factors' weights, clamped
 * to a floor of 0 so a net-negative error reads as "no attention needed" rather than a confusing
 * negative number. Higher = more actionable.
 */
export function scoreErrorAttention(factors: AttentionFactors): AttentionScore {
    const contributions: AttentionContribution[] = [];
    let raw = 0;
    for (const { key, label, weight } of WEIGHTS) {
        if (factors[key]) {
            raw += weight;
            contributions.push({ key: label, weight });
        }
    }
    return { score: Math.max(0, raw), contributions };
}
