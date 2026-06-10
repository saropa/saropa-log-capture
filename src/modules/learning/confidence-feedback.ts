/**
 * Confidence feedback loop (plan 053, Workstream C).
 *
 * Accept/reject history is persisted by {@link LearningStore} but was never read back into
 * scoring, so a pattern the user rejected was just as likely to be re-suggested next week.
 * This module turns that history into a confidence multiplier: prior accepts of a pattern
 * boost it, prior rejects penalize it, and patterns *similar* to one the user judged inherit
 * half the effect — so rejecting one framework-noise pattern also damps its near-twins.
 *
 * Pure and side-effect-free so the coefficients can be fixture-tested and tuned from real
 * acceptance data without touching the store or the engine.
 */

import type { PersistedRuleSuggestion } from "./learning-store";

/** Accept/reject tallies for a candidate pattern, split by exact vs. similar match. */
export interface SuggestionFeedback {
    /** Prior accepts of the identical pattern string. */
    readonly exactAccepts: number;
    /** Prior rejects of the identical pattern string. */
    readonly exactRejects: number;
    /** Prior accepts of a pattern with >80% substring overlap (not identical). */
    readonly similarAccepts: number;
    /** Prior rejects of a pattern with >80% substring overlap (not identical). */
    readonly similarRejects: number;
}

// C3 coefficients — a starting point, tune from real acceptance data. Each event nudges a
// multiplier that is finally clamped so feedback can never fully erase or runaway-inflate a
// pattern's extracted confidence.
const ACCEPT_FACTOR = 1.15; // per exact accept
const REJECT_FACTOR = 0.6; // per exact reject
const MULT_CEILING = 1.5;
const MULT_FLOOR = 0.1;
/** A pattern counts as "similar" at or above this substring-overlap ratio (but not identical). */
export const SIMILARITY_THRESHOLD = 0.8;

/** Halve an event's deviation from 1.0 — a "similar" match earns half the boost/penalty. */
function halfEffect(factor: number): number {
    return 1 + (factor - 1) / 2;
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, value));
}

/**
 * Adjust a raw extracted confidence by accumulated accept/reject feedback. The multiplier is
 * clamped to [0.1, 1.5] before applying, and the result is clamped to [0, 1].
 */
export function applyFeedback(rawConfidence: number, feedback: SuggestionFeedback): number {
    let mult = 1;
    mult *= ACCEPT_FACTOR ** feedback.exactAccepts;
    mult *= REJECT_FACTOR ** feedback.exactRejects;
    mult *= halfEffect(ACCEPT_FACTOR) ** feedback.similarAccepts;
    mult *= halfEffect(REJECT_FACTOR) ** feedback.similarRejects;
    return clamp(rawConfidence * clamp(mult, MULT_FLOOR, MULT_CEILING), 0, 1);
}

/**
 * Substring-overlap similarity in [0, 1]: 1.0 when identical, else the shorter string's length
 * over the longer's when the longer contains the shorter, otherwise 0. Cheap and deterministic —
 * good enough to group a noise pattern with the parameterized variants the extractor emits.
 */
export function patternSimilarity(a: string, b: string): number {
    if (a === b) { return 1; }
    if (!a || !b) { return 0; }
    const [shortStr, longStr] = a.length <= b.length ? [a, b] : [b, a];
    return longStr.includes(shortStr) ? shortStr.length / longStr.length : 0;
}

/**
 * Tally feedback for a candidate pattern from the persisted accept/reject history. Exact-string
 * matches feed the exact counters; >80%-overlap (non-identical) matches feed the similar counters.
 */
export function buildFeedback(
    pattern: string,
    history: readonly PersistedRuleSuggestion[],
): SuggestionFeedback {
    let exactAccepts = 0, exactRejects = 0, similarAccepts = 0, similarRejects = 0;
    for (const row of history) {
        if (row.status !== "accepted" && row.status !== "rejected") { continue; }
        const sim = patternSimilarity(pattern, row.pattern);
        const exact = sim === 1;
        const similar = !exact && sim >= SIMILARITY_THRESHOLD;
        if (!exact && !similar) { continue; }
        if (row.status === "accepted") { exact ? exactAccepts++ : similarAccepts++; }
        else { exact ? exactRejects++ : similarRejects++; }
    }
    return { exactAccepts, exactRejects, similarAccepts, similarRejects };
}
