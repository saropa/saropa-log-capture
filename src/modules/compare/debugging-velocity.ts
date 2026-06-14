/**
 * Debugging velocity (cross-session-analysis idea #14).
 *
 * Measures how effectively errors are being fixed across recent sessions: how many distinct error
 * fingerprints have stopped appearing (resolved) versus how many still show up in the latest
 * session (persisting), plus the average number of sessions a now-resolved error stuck around for.
 * Turns the cross-session fingerprint history into a simple "fix rate" the developer can watch.
 *
 * Pure (no vscode import) so it is unit-testable under `node --test`. The caller supplies each
 * session's error-fingerprint hashes in chronological order (oldest → newest).
 */

/** Minimum sessions for the metric to mean anything — one session has no "resolved vs persisting". */
const MIN_SESSIONS = 2;

export interface DebuggingVelocity {
    /** Distinct error fingerprints seen earlier but absent from the latest session. */
    readonly resolved: number;
    /** Distinct error fingerprints still present in the latest session. */
    readonly persisting: number;
    /** resolved / (resolved + persisting) as a whole-number percent; 0 when neither exists. */
    readonly velocityPct: number;
    /** Mean number of sessions a resolved error was present for (first-seen → last-seen span). */
    readonly avgSessionsToResolve: number;
}

/**
 * Compute the velocity from per-session fingerprint-hash lists, ordered oldest → newest. Returns
 * undefined when there are fewer than two sessions (nothing to compare) — callers stay silent.
 *
 * An error counts as persisting when it appears in the latest session, resolved when its most
 * recent appearance predates the latest session. "Sessions to resolve" is the inclusive span from
 * a resolved error's first appearance to its last (how long it lingered before going away).
 */
export function computeDebuggingVelocity(
    sessionHashes: readonly (readonly string[])[],
): DebuggingVelocity | undefined {
    if (sessionHashes.length < MIN_SESSIONS) { return undefined; }
    const lastIndex = sessionHashes.length - 1;

    // Per fingerprint, track first and last session index it appeared in.
    const span = new Map<string, { first: number; last: number }>();
    for (let i = 0; i < sessionHashes.length; i++) {
        for (const h of sessionHashes[i]) {
            const existing = span.get(h);
            if (existing) { existing.last = i; } else { span.set(h, { first: i, last: i }); }
        }
    }

    let resolved = 0;
    let persisting = 0;
    let resolvedSpanTotal = 0;
    for (const { first, last } of span.values()) {
        if (last === lastIndex) {
            persisting++;
        } else {
            resolved++;
            resolvedSpanTotal += last - first + 1;
        }
    }

    const denom = resolved + persisting;
    return {
        resolved,
        persisting,
        velocityPct: denom > 0 ? Math.round((resolved / denom) * 100) : 0,
        avgSessionsToResolve: resolved > 0 ? Math.round((resolvedSpanTotal / resolved) * 10) / 10 : 0,
    };
}
