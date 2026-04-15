/**
 * Cross-signal co-occurrence detection: finds signal pairs that consistently
 * appear together in the same sessions.
 *
 * Uses Jaccard similarity (|A ∩ B| / |A ∪ B|) on session sets. Pairs above
 * the threshold are flagged as co-occurring — useful for identifying causal
 * patterns (e.g. "slow SQL and OOM always appear together").
 */

import type { RecurringSignalEntry } from './recurring-signal-builder';

/** A pair of signals that co-occur across sessions above the Jaccard threshold. */
export interface SignalCoOccurrence {
    /** Fingerprint key of signal A (kind::fingerprint). */
    readonly signalA: string;
    /** Fingerprint key of signal B (kind::fingerprint). */
    readonly signalB: string;
    /** Human-readable label for signal A. */
    readonly labelA: string;
    /** Human-readable label for signal B. */
    readonly labelB: string;
    /** Number of sessions where both signals appear. */
    readonly sharedSessions: number;
    /** Jaccard similarity (0–1): intersection / union of session sets. */
    readonly jaccard: number;
}

/** Minimum sessions a signal must appear in to be considered for co-occurrence. */
const minSessions = 3;
/** Jaccard threshold: pairs below this are not considered co-occurring. */
const jaccardThreshold = 0.5;
const maxPairs = 10;

/**
 * Detect signal pairs that consistently co-occur in the same sessions.
 * Only considers signals in 3+ sessions to avoid noise from rare signals.
 */
export function detectCoOccurrences(signals: readonly RecurringSignalEntry[]): SignalCoOccurrence[] {
    // Filter to signals that appear in enough sessions to be meaningful
    const candidates = signals.filter(s => s.sessionCount >= minSessions);
    if (candidates.length < 2) { return []; }

    // Build session sets for each signal (Set<sessionName>)
    const sessionSets = candidates.map(s => ({
        key: `${s.kind}::${s.fingerprint}`,
        label: s.label,
        sessions: new Set(s.timeline.map(t => t.session)),
    }));

    const pairs: SignalCoOccurrence[] = [];
    for (let i = 0; i < sessionSets.length; i++) {
        for (let j = i + 1; j < sessionSets.length; j++) {
            const a = sessionSets[i];
            const b = sessionSets[j];
            const shared = countIntersection(a.sessions, b.sessions);
            if (shared < minSessions) { continue; }
            const union = a.sessions.size + b.sessions.size - shared;
            const jaccard = union > 0 ? shared / union : 0;
            if (jaccard < jaccardThreshold) { continue; }
            pairs.push({
                signalA: a.key, signalB: b.key,
                labelA: a.label, labelB: b.label,
                sharedSessions: shared, jaccard,
            });
        }
    }

    return pairs
        .sort((a, b) => b.jaccard - a.jaccard || b.sharedSessions - a.sharedSessions)
        .slice(0, maxPairs);
}

/** Count elements in the intersection of two sets. */
function countIntersection(a: Set<string>, b: Set<string>): number {
    // Iterate the smaller set for efficiency
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    let count = 0;
    for (const s of small) { if (large.has(s)) { count++; } }
    return count;
}
