/**
 * Signal reliability classification (cross-session-analysis idea #11, "ghost errors").
 *
 * Turns a signal's cross-session frequency into a reliability tier: how many of the analyzed
 * sessions it appears in, expressed as a percentage and a coarse label. Intermittent signals
 * (present in some sessions but not others) are often the hardest bugs, so making that pattern
 * explicit is the first step to understanding them.
 *
 * Pure (no vscode import) so it is unit-testable under `node --test`. The reliability tier feeds
 * the cross-session signal entries and is rendered next to each signal's session count.
 */

/** Coarse reliability bands. `consistent` ≈ always present, `rare` ≈ occasional, between = intermittent. */
export type SignalReliability = 'consistent' | 'intermittent' | 'rare';

/** At/above this share of sessions a signal is treated as consistently present. */
const CONSISTENT_MIN_PCT = 80;
/** At/above this share (but below consistent) a signal is intermittent; below it, rare. */
const INTERMITTENT_MIN_PCT = 25;

/** Percentage of sessions a signal appears in, plus its tier. */
export interface ReliabilityResult {
    /** Whole-number percent (0–100), rounded. */
    readonly percentage: number;
    readonly tier: SignalReliability;
}

/**
 * Classify a signal's reliability from how many sessions it touched out of the total considered.
 * Returns undefined when there are too few sessions (< 2) to make "intermittent" meaningful — a
 * signal seen in the only session that exists carries no reliability information.
 */
export function classifyReliability(
    sessionCount: number,
    totalSessions: number,
): ReliabilityResult | undefined {
    if (totalSessions < 2 || sessionCount <= 0) { return undefined; }
    // Clamp so a stale/duplicate count can never report above 100%.
    const ratio = Math.min(sessionCount, totalSessions) / totalSessions;
    const percentage = Math.round(ratio * 100);
    if (percentage >= CONSISTENT_MIN_PCT) { return { percentage, tier: 'consistent' }; }
    if (percentage >= INTERMITTENT_MIN_PCT) { return { percentage, tier: 'intermittent' }; }
    return { percentage, tier: 'rare' };
}
