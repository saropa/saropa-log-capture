/**
 * DB detector framework contracts (plan **DB_15**).
 *
 * The log viewer runs detectors inside embedded JavaScript; this module is the
 * TypeScript source of truth for shapes and for unit tests. Keep behavior in sync
 * with `viewer-db-detector-framework-script.ts`.
 */

/** Fingerprint stats for DB_10 batch compare and optional `baselineFingerprintSummary` on ingest. */
export interface DbFingerprintSummaryEntry {
  readonly count: number;
  readonly avgDurationMs?: number;
  readonly maxDurationMs?: number;
  /**
   * Lines that supplied `durationMs`; used when merging summaries so avg stays weighted.
   * Omitted when no durations were recorded (same as zero samples).
   */
  readonly durationSampleCount?: number;
  /**
   * Lines at or above the configured slow threshold (same semantics as slow-burst markers; DB_10 persist).
   */
  readonly slowQueryCount?: number;
}

/** Payload for `DbDetectorResult` with `kind: 'session-rollup-patch'` (embed applies via `updateDbInsightRollup`). */
export interface DbSessionRollupPatchPayload {
  readonly fingerprint: string;
  /** Apply rollup this many times (default 1). */
  readonly repeatCount?: number;
  readonly elapsedMs?: number;
}

/**
 * Patch fields onto an existing `allLines` row by `seq` (webview embed only).
 * Keep patches shallow and safe — unknown keys still copy; prefer documented line fields.
 */
export interface DbAnnotateLinePayload {
  readonly targetSeq: number;
  /** Shallow-merged onto the line item (e.g. `html`, `level`, `dbInsight`). */
  readonly patch: Readonly<Record<string, unknown>>;
}

/** One row of the union of baseline vs target keys (sorted by fingerprint for stable output). */
export interface DbFingerprintSummaryDiffRow {
  readonly fingerprint: string;
  readonly baseline?: DbFingerprintSummaryEntry;
  readonly target?: DbFingerprintSummaryEntry;
}

/** Batch compare pass: shared diff is computed once; detectors read slices they care about. */
export interface DbDetectorCompareInput {
  readonly baseline: ReadonlyMap<string, DbFingerprintSummaryEntry>;
  readonly target: ReadonlyMap<string, DbFingerprintSummaryEntry>;
  readonly diff: readonly DbFingerprintSummaryDiffRow[];
}

/** Per ingest event in the viewer (database / Drift SQL paths). */
export interface DbDetectorContext {
  readonly timestampMs: number;
  readonly sessionId: string | null;
  readonly sourceTag: string | null;
  readonly level: string;
  readonly plainText: string;
  readonly durationMs: number | undefined;
  /** Seq of the line completing this ingest event (slow-burst anchor); omit when unknown. */
  readonly anchorSeq?: number;
  readonly sql: {
    readonly fingerprint: string;
    readonly argsKey: string;
    readonly sqlSnippet?: string;
    readonly verb?: string;
  } | null;
  /** Reserved for DB_10 session compare; omit in normal streaming ingest. */
  readonly baselineFingerprintSummary?: ReadonlyMap<string, DbFingerprintSummaryEntry>;
}

export type DbDetectorResultKind =
  | "synthetic-line"
  | "annotate-line"
  | "marker"
  | "session-rollup-patch";

/** N+1 synthetic row payload (adapter builds HTML / line item). */
export interface DbNPlusOneSyntheticPayload {
  readonly syntheticType: "n-plus-one-insight";
  readonly insight: {
    readonly repeats: number;
    readonly distinctArgs: number;
    readonly windowSpanMs: number;
    readonly confidence: string;
  };
  readonly sqlMeta: {
    readonly fingerprint: string;
    readonly argsKey: string;
    readonly sqlSnippet?: string;
    readonly verb?: string;
  };
}

export type DbDetectorSyntheticPayload = DbNPlusOneSyntheticPayload;

export interface DbDetectorResult {
  readonly kind: DbDetectorResultKind;
  readonly detectorId: string;
  readonly stableKey: string;
  /** Lower numbers run first; on duplicate `stableKey`, higher priority wins (last write). */
  readonly priority: number;
  readonly payload:
    | DbDetectorSyntheticPayload
    | DbSessionRollupPatchPayload
    | DbAnnotateLinePayload
    | Record<string, unknown>;
}

export interface DbDetectorDefinition {
  readonly id: string;
  readonly priority: number;
  feed(ctx: DbDetectorContext): readonly DbDetectorResult[];
  /** Optional DB_10-style batch compare; streaming ingest still uses `feed` only. */
  readonly compare?: (input: DbDetectorCompareInput) => readonly DbDetectorResult[];
}

/** Mutable session state for the extension host or tests (embed uses plain objects). */
export interface DbDetectorSessionState {
  readonly disabledDetectorIds: Set<string>;
  readonly loggedDetectorErrors: Set<string>;
}
