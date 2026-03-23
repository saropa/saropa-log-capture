/**
 * DB_14 root-cause hint bundle and hypothesis shapes (shared with unit tests).
 * Embedded viewer logic must stay aligned with `buildHypotheses` in `build-hypotheses.ts`.
 */

export const ROOT_CAUSE_HINT_BUNDLE_VERSION = 1 as const;

export interface RootCauseHintError {
  readonly lineIndex: number;
  readonly excerpt: string;
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

export interface RootCauseHintBundle {
  readonly bundleVersion: number;
  readonly sessionId: string;
  readonly errors?: readonly RootCauseHintError[];
  readonly sqlBursts?: readonly RootCauseSqlBurst[];
  readonly nPlusOneHints?: readonly RootCauseNPlusOneHint[];
  readonly fingerprintLeaders?: readonly RootCauseFingerprintLeader[];
  readonly driftAdvisorSummary?: RootCauseDriftAdvisorSummary;
  readonly sessionDiffSummary?: RootCauseSessionDiffSummary;
}

export type RootCauseHypothesisConfidence = 'low' | 'medium';

export interface RootCauseHypothesis {
  readonly templateId: string;
  readonly text: string;
  readonly evidenceLineIds: readonly number[];
  readonly confidence?: RootCauseHypothesisConfidence;
  readonly hypothesisKey: string;
}
