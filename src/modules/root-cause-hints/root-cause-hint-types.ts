/**
 * DB_14 root-cause hint bundle and hypothesis shapes (shared with unit tests).
 *
 * Bundle version 2 adds general signal types (warnings, network, memory, ANR, etc.)
 * alongside the original SQL-specific types from version 1.
 */

export const ROOT_CAUSE_HINT_BUNDLE_VERSION = 2 as const;

// --- Existing SQL/error types (v1) ---

export interface RootCauseHintError {
  readonly lineIndex: number;
  readonly excerpt: string;
  readonly fingerprint?: string;
  readonly category?: string;
}

export interface RootCauseSqlBurst {
  readonly fingerprint: string;
  readonly count: number;
  readonly windowMs?: number;
}

export interface RootCauseNPlusOneHint {
  readonly lineIndex: number;
  readonly fingerprint: string;
  readonly repeats: number;
  readonly distinctArgs: number;
  readonly windowSpanMs: number;
  readonly confidence: string;
}

export interface RootCauseFingerprintLeader {
  readonly fingerprint: string;
  readonly count: number;
  readonly sampleLineIndex: number;
}

export interface RootCauseDriftAdvisorSummary {
  readonly issueCount: number;
  readonly topRuleId?: string;
}

export interface RootCauseSessionDiffSummary {
  readonly regressionFingerprints?: readonly string[];
}

// --- General signal types (v2) ---

/** Recurring warning grouped by normalized text. */
export interface SignalWarningGroup {
  readonly excerpt: string;
  readonly count: number;
  readonly lineIndices: readonly number[];
}

/** Network/connectivity failure. */
export interface SignalNetworkFailure {
  readonly lineIndex: number;
  readonly excerpt: string;
  readonly pattern: string;
}

/** Memory pressure or OOM event. */
export interface SignalMemoryEvent {
  readonly lineIndex: number;
  readonly excerpt: string;
}

/** Operation exceeding a duration threshold. */
export interface SignalSlowOperation {
  readonly lineIndex: number;
  readonly excerpt: string;
  readonly durationMs: number;
  /** PERF-line operation name (e.g. "dbEventCountForDate"), absent for generic duration lines. */
  readonly operationName?: string;
}

/** Permission denial. */
export interface SignalPermissionDenial {
  readonly lineIndex: number;
  readonly excerpt: string;
}

/** Error classified by crash category or error type. */
export interface SignalClassifiedError {
  readonly lineIndex: number;
  readonly excerpt: string;
  readonly classification: 'critical' | 'bug';
}

/** ANR risk result from host-side scorer. */
export interface SignalAnrRisk {
  readonly score: number;
  readonly level: 'low' | 'medium' | 'high';
  readonly signals: readonly string[];
}

// --- Bundle ---

export interface RootCauseHintBundle {
  readonly bundleVersion: number;
  readonly sessionId: string;
  // v1 fields
  readonly errors?: readonly RootCauseHintError[];
  readonly sqlBursts?: readonly RootCauseSqlBurst[];
  readonly nPlusOneHints?: readonly RootCauseNPlusOneHint[];
  readonly fingerprintLeaders?: readonly RootCauseFingerprintLeader[];
  readonly driftAdvisorSummary?: RootCauseDriftAdvisorSummary;
  readonly sessionDiffSummary?: RootCauseSessionDiffSummary;
  // v2 fields
  readonly warningGroups?: readonly SignalWarningGroup[];
  readonly networkFailures?: readonly SignalNetworkFailure[];
  readonly memoryEvents?: readonly SignalMemoryEvent[];
  readonly slowOperations?: readonly SignalSlowOperation[];
  readonly permissionDenials?: readonly SignalPermissionDenial[];
  readonly classifiedErrors?: readonly SignalClassifiedError[];
  readonly anrRisk?: SignalAnrRisk;
}

// --- Hypothesis output ---

export type RootCauseHypothesisConfidence = 'low' | 'medium' | 'high';

export interface RootCauseHypothesis {
  readonly templateId: string;
  readonly text: string;
  readonly evidenceLineIds: readonly number[];
  readonly confidence?: RootCauseHypothesisConfidence;
  /** Human-readable reason for the confidence level (e.g. "fatal crash, 3 occurrences"). */
  readonly confidenceReason?: string;
  readonly hypothesisKey: string;
}
