import {
  ROOT_CAUSE_FP_LEADER_MIN_COUNT,
  ROOT_CAUSE_SQL_BURST_MIN_COUNT,
} from './root-cause-hint-eligibility';
import type {
  RootCauseFingerprintLeader,
  RootCauseHintBundle,
  RootCauseHypothesisConfidence,
  RootCauseNPlusOneHint,
} from './root-cause-hint-types';
import type { WorkingHypothesis } from './build-hypotheses-general';
import { truncateText } from './build-hypotheses-text';

function mapN1Confidence(c: string | undefined): RootCauseHypothesisConfidence {
  const x = (c || '').toLowerCase();
  if (x === 'high' || x === 'medium') { return 'medium'; }
  return 'low';
}

/** Build hypotheses for N+1 query patterns. */
export function nPlusOneHypotheses(
  hints: readonly RootCauseNPlusOneHint[] | undefined,
  maxTextLen: number,
): WorkingHypothesis[] {
  if (!hints || hints.length === 0) {
    return [];
  }
  const out: WorkingHypothesis[] = [];
  for (const h of hints) {
    if (!h || !h.fingerprint) {
      continue;
    }
    const sec = (h.windowSpanMs / 1000).toFixed(1);
    const text = truncateText(
      `${h.repeats} similar DB calls with ${h.distinctArgs} different arguments in ${sec}s (possible N+1 query)`,
      maxTextLen,
    );
    out.push({
      templateId: 'n-plus-one',
      text,
      evidenceLineIds: [h.lineIndex],
      confidence: mapN1Confidence(h.confidence),
      hypothesisKey: `n1::${h.fingerprint}`,
      tier: 1,
    });
  }
  return out;
}

/** Build hypotheses for rapid SQL burst patterns. */
export function sqlBurstHypotheses(bundle: RootCauseHintBundle, maxTextLen: number): WorkingHypothesis[] {
  const bursts = bundle.sqlBursts;
  if (!bursts || bursts.length === 0) {
    return [];
  }
  const out: WorkingHypothesis[] = [];
  for (const b of bursts) {
    if (!b || !b.fingerprint || b.count < ROOT_CAUSE_SQL_BURST_MIN_COUNT) {
      continue;
    }
    const w = typeof b.windowMs === 'number' ? ` in ~${Math.round(b.windowMs)}ms` : '';
    out.push({
      templateId: 'sql-burst',
      text: truncateText(`${b.count} identical queries fired${w} (rapid burst)`, maxTextLen),
      evidenceLineIds: [],
      confidence: 'low',
      hypothesisKey: `burst::${b.fingerprint}`,
      tier: 1,
    });
  }
  return out;
}

/** Build hypotheses for high-frequency fingerprint leaders. */
export function fingerprintLeaderHypotheses(
  leaders: readonly RootCauseFingerprintLeader[] | undefined,
  n1Fingerprints: Set<string>,
  maxTextLen: number,
): WorkingHypothesis[] {
  if (!leaders || leaders.length === 0) {
    return [];
  }
  const out: WorkingHypothesis[] = [];
  for (const L of leaders) {
    if (!L || !L.fingerprint || L.count < ROOT_CAUSE_FP_LEADER_MIN_COUNT) {
      continue;
    }
    if (n1Fingerprints.has(L.fingerprint)) {
      continue;
    }
    out.push({
      templateId: 'fingerprint-leader',
      text: truncateText(
        `Same SQL query executed ${L.count} times this session (consider batching or caching)`,
        maxTextLen,
      ),
      evidenceLineIds: L.sampleLineIndex >= 0 ? [L.sampleLineIndex] : [],
      confidence: 'low',
      hypothesisKey: `fp::${L.fingerprint}`,
      tier: 2,
    });
  }
  return out;
}

/** Build hypotheses for session-diff regressions. */
export function diffHypotheses(bundle: RootCauseHintBundle, maxTextLen: number): WorkingHypothesis[] {
  const d = bundle.sessionDiffSummary;
  if (!d || !d.regressionFingerprints || d.regressionFingerprints.length === 0) {
    return [];
  }
  const fp = d.regressionFingerprints[0];
  return [
    {
      templateId: 'session-diff-regression',
      text: truncateText(`SQL query volume increased compared to previous session (performance regression)`, maxTextLen),
      evidenceLineIds: [],
      confidence: 'low',
      hypothesisKey: `diff::${fp}`,
      tier: 0,
    },
  ];
}

/** Build hypotheses from Drift Advisor static analysis. */
export function driftHypotheses(bundle: RootCauseHintBundle, maxTextLen: number): WorkingHypothesis[] {
  const da = bundle.driftAdvisorSummary;
  if (!da || da.issueCount <= 0) {
    return [];
  }
  const rule = da.topRuleId ? ` (${da.topRuleId})` : '';
  return [
    {
      templateId: 'drift-advisor',
      text: truncateText(`Drift static analysis found ${da.issueCount} issue${da.issueCount === 1 ? '' : 's'}${rule} in the workspace`, maxTextLen),
      evidenceLineIds: [],
      confidence: 'low',
      hypothesisKey: 'drift::summary',
      tier: 1,
    },
  ];
}
