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
 * Build the pulse, or undefined when there is nothing to report — no improving/worsening/stable
 * signals and no velocity. Returning undefined keeps the strip absent rather than showing an empty
 * "0 / 0 / 0" row (the Signals surface stays passive until it has something to say).
 */
export function computeWorkspacePulse(input: WorkspacePulseInput): WorkspacePulse | undefined {
    const improving = Math.max(0, input.resolvedErrorCount);
    const worsening = Math.max(0, input.newErrorCount);
    const stable = Math.max(0, input.recurringCount);
    const hasVelocity = typeof input.velocityPct === 'number';
    if (improving === 0 && worsening === 0 && stable === 0 && !hasVelocity) { return undefined; }
    return {
        improving,
        worsening,
        stable,
        velocityPct: hasVelocity ? input.velocityPct : undefined,
        tone: classifyTone(improving, worsening),
    };
}
