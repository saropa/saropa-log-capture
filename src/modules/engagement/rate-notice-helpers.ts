/**
 * Pure rating-notice helpers (no `vscode` import) so they can be unit-tested headlessly.
 * Modeled on `welcomePanelUpgrade.ts` from the saropa_lints porting guide.
 */

/**
 * Minimum activations before the first "please rate" prompt. Set high enough that the
 * user has formed a real opinion — roughly 2–3 weeks of daily use.
 */
export const RATE_ACTIVATION_THRESHOLD = 15;

/** Permanent outcomes that suppress the prompt forever. */
export type RateOutcome = 'rated' | 'dismissed';

/**
 * Whether the prompt should fire this activation: the counter has reached the threshold
 * and no permanent outcome (rated or dismissed) has been recorded.
 */
export function shouldPromptForRating(
    activationCount: number,
    outcome: RateOutcome | undefined,
): boolean {
    // A permanent decision by the user ends the prompt cycle.
    if (outcome !== undefined) { return false; }
    return activationCount >= RATE_ACTIVATION_THRESHOLD;
}

/**
 * Human-readable reason for the prompt decision, for the debug log. Mirrors
 * shouldPromptForRating's branches so the log never disagrees with behavior.
 */
export function describeRateDecision(
    activationCount: number,
    outcome: RateOutcome | undefined,
    shown: boolean,
): string {
    if (outcome === 'rated') { return 'user already rated'; }
    if (outcome === 'dismissed') { return 'user chose not to be asked again'; }
    if (shown) { return `activation count ${activationCount} reached threshold ${RATE_ACTIVATION_THRESHOLD}`; }
    return `activation count ${activationCount} below threshold ${RATE_ACTIVATION_THRESHOLD}`;
}
