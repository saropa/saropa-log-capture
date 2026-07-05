/**
 * Workspace pulse (cross-session-analysis idea #20).
 *
 * Composes the already-computed cross-session signals into a one-line "how is the project trending"
 * summary for the top of the Signals panel — error types improving (resolved), worsening (newly
 * appeared), and stable (recurring), plus the debugging fix-rate. Deliberately NOT a new panel: it
 * reuses the Signals panel's existing data round-trip and renders as a compact strip.
 *
 * Pure (no vscode import) so the composition and the overall-tone classification are unit-testable
 * under `node --test`. The host supplies counts it already has (regression detector + aggregator +
 * debugging velocity); this module owns only the packaging and the improving/worsening verdict.
 */

/** Counts the pulse is built from — all already computed elsewhere in the signal-data path. */
export interface WorkspacePulseInput {
    /** Error types new to the latest session (regression detector F7) — worsening. */
    readonly newErrorCount: number;
    /** Error types that disappeared vs recent sessions (regression detector F8) — improving. */
    readonly resolvedErrorCount: number;
    /** Recurring error/warning signals across sessions — the persistent baseline. */
    readonly recurringCount: number;
    /** Debugging fix-rate percent (0–100), when there is enough history; omitted otherwise. */
    readonly velocityPct?: number;
}

/** Overall direction, used to accent the strip. */
export type PulseTone = 'improving' | 'worsening' | 'steady';

export interface WorkspacePulse {
    readonly improving: number;
    readonly worsening: number;
    readonly stable: number;
    readonly velocityPct?: number;
    readonly tone: PulseTone;
}

/** More resolved than new → improving; more new than resolved → worsening; tie → steady. */
function classifyTone(improving: number, worsening: number): PulseTone {
    if (improving > worsening) { return 'improving'; }
    if (worsening > improving) { return 'worsening'; }
    return 'steady';
}

/**
 * Build the pulse, or undefined when there is nothing to report. Two "nothing to say" cases both
 * return undefined so the strip stays absent (the Signals surface is passive until it has content):
 *   1. No improving/worsening/stable signals AND no fix-rate at all.
 *   2. No improving/worsening/stable signals AND a fix-rate of 0% — a "Fixed 0%" with zero tracked
 *      issues is vacuous (there is nothing that COULD have been fixed), and rendered as an all-zero
 *      "▲ 0 · ▼ 0 · ● 0 · Fixed 0%" strip it just reads as noise. A positive fix-rate still shows
 *      (velocity alone is meaningful), and a 0% fix-rate still shows when there ARE stable issues to
 *      fix (that "Fixed 0% of N" is a real, actionable signal).
 */
export function computeWorkspacePulse(input: WorkspacePulseInput): WorkspacePulse | undefined {
    const improving = Math.max(0, input.resolvedErrorCount);
    const worsening = Math.max(0, input.newErrorCount);
    const stable = Math.max(0, input.recurringCount);
    const hasCounts = improving > 0 || worsening > 0 || stable > 0;
    const hasVelocityNumber = typeof input.velocityPct === 'number';
    // A fix-rate is worth showing only when it is positive, or when there are tracked issues it
    // measures against — a bare 0% with no baseline carries no information.
    const velocityIsMeaningful = hasVelocityNumber && (hasCounts || (input.velocityPct as number) > 0);
    if (!hasCounts && !velocityIsMeaningful) { return undefined; }
    return {
        improving,
        worsening,
        stable,
        velocityPct: velocityIsMeaningful ? input.velocityPct : undefined,
        tone: classifyTone(improving, worsening),
    };
}
