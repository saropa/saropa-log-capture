/**
 * Persisted signal summary types for cross-session aggregation.
 *
 * When a session is finalized, the last root-cause hint bundle collected by
 * the viewer is compressed into a compact summary and saved to SessionMeta.
 * The cross-session aggregator reads these summaries to build signal trends
 * across sessions (e.g. "N+1 queries detected in 8 of your last 10 sessions").
 */

/** Schema version for forward-compatibility checks on read. */
export const SIGNAL_SUMMARY_SCHEMA_VERSION = 1 as const;

/** Counts of each signal type detected in a single session. */
export interface SignalSummaryCounts {
    readonly errors?: number;
    readonly sqlBursts?: number;
    readonly nPlusOneHints?: number;
    readonly warningGroups?: number;
    readonly networkFailures?: number;
    readonly memoryEvents?: number;
    readonly slowOperations?: number;
    readonly permissionDenials?: number;
    readonly classifiedErrors?: number;
}

/**
 * Compact signal summary persisted to SessionMeta.
 * Contains only counts and capped string identifiers — no line indices or excerpts.
 */
export interface PersistedSignalSummaryV1 {
    readonly schemaVersion: typeof SIGNAL_SUMMARY_SCHEMA_VERSION;
    readonly counts: SignalSummaryCounts;
    readonly anrRiskLevel?: 'low' | 'medium' | 'high';
    /** Template IDs of hypotheses generated (e.g. 'n-plus-one', 'network-failure'). Max 5. */
    readonly hypothesisTemplateIds?: readonly string[];
    /** Top N+1 query fingerprints for cross-session dedup. Max 3. */
    readonly topNPlusOneFingerprints?: readonly string[];
    /** Top slow operation names by duration. Max 3. */
    readonly topSlowOps?: readonly string[];
}

/** Type guard for reading persisted summaries from metadata (handles schema drift). */
export function isPersistedSignalSummaryV1(v: unknown): v is PersistedSignalSummaryV1 {
    if (!v || typeof v !== 'object') { return false; }
    const obj = v as Record<string, unknown>;
    return obj.schemaVersion === SIGNAL_SUMMARY_SCHEMA_VERSION && typeof obj.counts === 'object' && obj.counts !== null;
}
