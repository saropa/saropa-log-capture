import {
  isRootCauseHintsEligible,
  ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN,
  ROOT_CAUSE_FP_LEADER_MIN_COUNT,
  ROOT_CAUSE_SQL_BURST_MIN_COUNT,
} from './root-cause-hint-eligibility';
import type {
  RootCauseFingerprintLeader,
  RootCauseHintBundle,
  RootCauseHypothesis,
  RootCauseHypothesisConfidence,
  RootCauseNPlusOneHint,
} from './root-cause-hint-types';

/**
 * Deterministic, template-only root-cause **hypotheses** for the log viewer (plan **DB_14**).
 *
 * **Why this module exists:** The webview cannot import TypeScript at runtime, so the same numeric
 * thresholds and ordering rules are mirrored in `viewer-root-cause-hints-embed-algorithm.ts`. This
 * file is the source of truth for **unit tests** and for any future host-side reuse (e.g. AI explain
 * payload). When you change eligibility floors, template text, tier order, dedup keys, or caps, update
 * both places and run `build-hypotheses.test.ts` plus embed tests in `viewer-n-plus-one-embed.test.ts`.
 *
 * **Safety:** `buildHypotheses` is pure (no I/O). It returns an empty array for unknown
 * `bundleVersion` or ineligible bundles so the UI stays silent rather than guessing.
 *
 * **Caps:** {@link ROOT_CAUSE_MAX_HYPOTHESES} bullets, {@link ROOT_CAUSE_MAX_TEXT_LEN} characters per
 * bullet (excluding link chrome in the viewer), {@link ROOT_CAUSE_MAX_EVIDENCE_IDS} line indices per
 * hypothesis after dedup.
 */
export const ROOT_CAUSE_MAX_HYPOTHESES = 5;
export const ROOT_CAUSE_MAX_TEXT_LEN = 240;
export const ROOT_CAUSE_MAX_EVIDENCE_IDS = 8;

const MAX_BULLETS = ROOT_CAUSE_MAX_HYPOTHESES;
const MAX_TEXT_LEN = ROOT_CAUSE_MAX_TEXT_LEN;
const MAX_EVIDENCE_IDS = ROOT_CAUSE_MAX_EVIDENCE_IDS;

type Tier = 0 | 1 | 2;

interface WorkingHypothesis extends RootCauseHypothesis {
  readonly tier: Tier;
}

function truncateText(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function mapN1Confidence(c: string | undefined): RootCauseHypothesisConfidence | undefined {
  const x = (c || '').toLowerCase();
  if (x === 'high' || x === 'medium') {
    return 'medium';
  }
  if (x === 'low') {
    return 'low';
  }
  return 'low';
}

/** True when the excerpt is a decorative separator with no letters or digits (e.g. `═══════`). */
function isDecorativeExcerpt(s: string): boolean {
  return !/[a-zA-Z0-9]/.test(s);
}

/** Stable grouping key: last 100 chars of normalized excerpt, skipping leading timestamps. */
function normalizeErrKey(excerpt: string): string {
  return excerpt
    .replace(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s*/, '')
    .replace(/\s+/g, ' ')
    .slice(-100)
    .toLowerCase();
}

function errorHypotheses(bundle: RootCauseHintBundle): WorkingHypothesis[] {
  const errs = bundle.errors;
  if (!errs || errs.length === 0) {
    return [];
  }
  const groups = new Map<string, { excerpt: string; lineIds: number[] }>();
  for (const e of errs) {
    if (!e) { continue; }
    const ex = (e.excerpt || '').trim();
    if (ex.length < ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) { continue; }
    if (isDecorativeExcerpt(ex)) { continue; }
    const key = normalizeErrKey(ex);
    const group = groups.get(key);
    if (group) {
      group.lineIds.push(e.lineIndex);
    } else {
      groups.set(key, { excerpt: ex, lineIds: [e.lineIndex] });
    }
  }
  const ranked = Array.from(groups.entries())
    .sort((a, b) => b[1].lineIds.length - a[1].lineIds.length)
    .slice(0, 2);
  return ranked.map(([key, { excerpt, lineIds }]) => ({
    templateId: 'error-recent',
    text: truncateText(`Error: ${excerpt}`, MAX_TEXT_LEN),
    evidenceLineIds: lineIds.slice().sort((a, b) => a - b),
    confidence: 'medium',
    hypothesisKey: `err::${key}`,
    tier: 0 as Tier,
  }));
}

function nPlusOneHypotheses(hints: readonly RootCauseNPlusOneHint[] | undefined): WorkingHypothesis[] {
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
      MAX_TEXT_LEN,
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

function sqlBurstHypotheses(bundle: RootCauseHintBundle): WorkingHypothesis[] {
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
      text: truncateText(`${b.count} identical queries fired${w} (rapid burst)`, MAX_TEXT_LEN),
      evidenceLineIds: [],
      confidence: 'low',
      hypothesisKey: `burst::${b.fingerprint}`,
      tier: 1,
    });
  }
  return out;
}

function fingerprintLeaderHypotheses(
  leaders: readonly RootCauseFingerprintLeader[] | undefined,
  n1Fingerprints: Set<string>,
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
        MAX_TEXT_LEN,
      ),
      evidenceLineIds: L.sampleLineIndex >= 0 ? [L.sampleLineIndex] : [],
      confidence: 'low',
      hypothesisKey: `fp::${L.fingerprint}`,
      tier: 2,
    });
  }
  return out;
}

function diffHypotheses(bundle: RootCauseHintBundle): WorkingHypothesis[] {
  const d = bundle.sessionDiffSummary;
  if (!d || !d.regressionFingerprints || d.regressionFingerprints.length === 0) {
    return [];
  }
  const fp = d.regressionFingerprints[0];
  return [
    {
      templateId: 'session-diff-regression',
      text: truncateText(`SQL query volume increased compared to previous session (performance regression)`, MAX_TEXT_LEN),
      evidenceLineIds: [],
      confidence: 'low',
      hypothesisKey: `diff::${fp}`,
      tier: 0,
    },
  ];
}

function driftHypotheses(bundle: RootCauseHintBundle): WorkingHypothesis[] {
  const da = bundle.driftAdvisorSummary;
  if (!da || da.issueCount <= 0) {
    return [];
  }
  const rule = da.topRuleId ? ` (${da.topRuleId})` : '';
  return [
    {
      templateId: 'drift-advisor',
      text: truncateText(`Drift static analysis found ${da.issueCount} issue${da.issueCount === 1 ? '' : 's'}${rule} in the workspace`, MAX_TEXT_LEN),
      evidenceLineIds: [],
      confidence: 'low',
      hypothesisKey: 'drift::summary',
      tier: 1,
    },
  ];
}

function dedupeAndMerge(work: WorkingHypothesis[]): WorkingHypothesis[] {
  const byKey = new Map<string, WorkingHypothesis>();
  for (const h of work) {
    const prev = byKey.get(h.hypothesisKey);
    if (!prev) {
      byKey.set(h.hypothesisKey, h);
      continue;
    }
    const ids = new Set<number>([...prev.evidenceLineIds, ...h.evidenceLineIds]);
    const merged = Array.from(ids).filter((n) => n >= 0).slice(0, MAX_EVIDENCE_IDS);
    const tier = Math.min(prev.tier, h.tier) as Tier;
    byKey.set(h.hypothesisKey, {
      ...prev,
      evidenceLineIds: merged,
      tier,
      confidence: prev.confidence === 'medium' || h.confidence === 'medium' ? 'medium' : prev.confidence ?? h.confidence,
    });
  }
  return Array.from(byKey.values());
}

function capEvidence(ids: readonly number[]): number[] {
  const u = Array.from(
    new Set(
      ids.filter((n) => {
        return Number.isFinite(n) && n >= 0;
      }),
    ),
  );
  return u.slice(0, MAX_EVIDENCE_IDS);
}

function stripWorking(h: WorkingHypothesis): RootCauseHypothesis {
  return {
    templateId: h.templateId,
    text: h.text,
    evidenceLineIds: capEvidence(h.evidenceLineIds),
    confidence: h.confidence,
    hypothesisKey: h.hypothesisKey,
  };
}

/** @see module comment above for contract and sync requirements with the webview embed. */
export function buildHypotheses(bundle: RootCauseHintBundle): RootCauseHypothesis[] {
  if (!bundle || bundle.bundleVersion !== 1) {
    return [];
  }
  if (!isRootCauseHintsEligible(bundle)) {
    return [];
  }

  const n1List = bundle.nPlusOneHints;
  const n1Fingerprints = new Set<string>();
  if (n1List) {
    for (const h of n1List) {
      if (h?.fingerprint) {
        n1Fingerprints.add(h.fingerprint);
      }
    }
  }

  const parts: WorkingHypothesis[] = [
    ...errorHypotheses(bundle),
    ...diffHypotheses(bundle),
    ...nPlusOneHypotheses(n1List),
    ...sqlBurstHypotheses(bundle),
    ...driftHypotheses(bundle),
    ...fingerprintLeaderHypotheses(bundle.fingerprintLeaders, n1Fingerprints),
  ];

  const merged = dedupeAndMerge(parts);
  merged.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    return a.hypothesisKey.localeCompare(b.hypothesisKey);
  });

  return merged.slice(0, MAX_BULLETS).map(stripWorking);
}
