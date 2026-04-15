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
    return typeof obj.schemaVersion === 'number' && typeof obj.counts === 'object' && obj.counts !== null;
}

// --- V2: persists actual signal entries alongside counts so cross-session views
// have detail without re-scanning. Backwards-compatible with V1 readers (same
// schemaVersion field check, extra fields ignored). ---

/** Schema version for V2 summaries. */
export const SIGNAL_SUMMARY_SCHEMA_VERSION_V2 = 2 as const;

/** A compact signal entry persisted to metadata. */
export interface PersistedSignalEntryV2 {
    readonly kind: string;
    readonly fingerprint: string;
    readonly label: string;
    readonly detail?: string;
    readonly count: number;
    readonly category?: string;
    readonly avgDurationMs?: number;
    readonly maxDurationMs?: number;
    /** Top line indices where this signal was detected (for jump-to-line navigation). Max 3. */
    readonly lineIndices?: readonly number[];
}

/**
 * V2 signal summary: extends V1 with actual entries for signal types that
 * previously only stored counts (network failures, memory events, slow ops, etc.).
 * Error/warning/perf/SQL fingerprints are already persisted separately in metadata,
 * so V2 entries focus on count-only signal types.
 */
export interface PersistedSignalSummaryV2 extends Omit<PersistedSignalSummaryV1, 'schemaVersion'> {
    readonly schemaVersion: typeof SIGNAL_SUMMARY_SCHEMA_VERSION_V2;
    /** Top signal entries with full detail for count-only types. Max 20. */
    readonly entries?: readonly PersistedSignalEntryV2[];
}

/** Type guard for V2 summaries (V1 summaries also pass isPersistedSignalSummaryV1). */
export function isPersistedSignalSummaryV2(v: unknown): v is PersistedSignalSummaryV2 {
    if (!v || typeof v !== 'object') { return false; }
    const obj = v as Record<string, unknown>;
    return obj.schemaVersion === SIGNAL_SUMMARY_SCHEMA_VERSION_V2 && typeof obj.counts === 'object' && obj.counts !== null;
}
