import {
  isRootCauseHintsEligible,
  ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN,
} from './root-cause-hint-eligibility';
import type {
  RootCauseHintBundle,
  RootCauseHypothesis,
  RootCauseHypothesisConfidence,
} from './root-cause-hint-types';
import {
  anrHypotheses,
  classifiedErrorHypotheses,
  memoryHypotheses,
  networkHypotheses,
  permissionHypotheses,
  slowOpHypotheses,
  warningHypotheses,
  type Tier,
  type WorkingHypothesis,
} from './build-hypotheses-general';
import {
  diffHypotheses,
  driftHypotheses,
  fingerprintLeaderHypotheses,
  nPlusOneHypotheses,
  sqlBurstHypotheses,
} from './build-hypotheses-sql';
import { classifyCategory, hashFingerprint, normalizeLine } from '../analysis/error-fingerprint-pure';
import { truncateText } from './build-hypotheses-text';

/**
 * Deterministic, template-only root-cause **hypotheses** for the log viewer (plan **DB_14**).
 *
 * **Why this module exists:** This is the single source of truth for hypothesis generation. The
 * webview collects raw signal data and posts the bundle to the host, which calls `buildHypotheses`
 * here. No algorithm duplication — changes only need to be made in this file.
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

/** True when the excerpt is a decorative separator with no letters or digits (e.g. `═══════`). */
function isDecorativeExcerpt(s: string): boolean {
  return !/[a-zA-Z0-9]/.test(s);
}

/** Build a human-readable reason for the confidence level. */
function buildConfidenceReason(cat: string, occurrences: number): string {
  const catLabel = cat === 'non-fatal' ? 'non-fatal error' : `${cat} crash`;
  const countLabel = occurrences === 1 ? '1 occurrence' : `${occurrences} occurrences`;
  return `${catLabel}, ${countLabel}`;
}

/** Map crash category to confidence level. */
function categoryConfidence(cat: string): RootCauseHypothesisConfidence {
  if (cat === 'fatal' || cat === 'anr' || cat === 'oom' || cat === 'native') {
    return 'high';
  }
  return 'medium';
}

function errorHypotheses(bundle: RootCauseHintBundle): WorkingHypothesis[] {
  const errs = bundle.errors;
  if (!errs || errs.length === 0) { return []; }
  const groups = new Map<string, { excerpt: string; lineIds: number[]; cat: string }>();
  for (const e of errs) {
    if (!e) { continue; }
    const ex = (e.excerpt || '').trim();
    if (ex.length < ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) { continue; }
    if (isDecorativeExcerpt(ex)) { continue; }
    const key = e.fingerprint ?? hashFingerprint(normalizeLine(ex));
    const cat = e.category ?? classifyCategory(ex);
    const group = groups.get(key);
    if (group) {
      group.lineIds.push(e.lineIndex);
    } else {
      groups.set(key, { excerpt: ex, lineIds: [e.lineIndex], cat });
    }
  }
  const ranked = Array.from(groups.entries())
    .sort((a, b) => b[1].lineIds.length - a[1].lineIds.length)
    .slice(0, 2);
  return ranked.map(([key, { excerpt, lineIds, cat }]) => ({
    templateId: 'error-recent',
    text: truncateText(`Error: ${excerpt}`, MAX_TEXT_LEN),
    evidenceLineIds: lineIds.slice().sort((a, b) => a - b),
    confidence: categoryConfidence(cat),
    confidenceReason: buildConfidenceReason(cat, lineIds.length),
    hypothesisKey: `err::${key}`,
    tier: 0 as Tier,
  }));
}

const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

function pickHigherConfidence(
  a: RootCauseHypothesisConfidence | undefined,
  b: RootCauseHypothesisConfidence | undefined,
): RootCauseHypothesisConfidence | undefined {
  return (confRank[a ?? ''] ?? 0) >= (confRank[b ?? ''] ?? 0) ? a : b;
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
      confidence: pickHigherConfidence(prev.confidence, h.confidence),
    });
  }
  return Array.from(byKey.values());
}

/**
 * Bug 002 fix: when a high-confidence ANR hypothesis exists, error-recent
 * hypotheses are almost certainly ANR dump lines (CPU stats, IO pressure,
 * process list). Instead of showing them as separate reports, merge their
 * evidence line IDs into the ANR hypothesis so the single ANR report links
 * to the actual dump lines. No information is lost — the user sees one
 * consolidated report instead of three overlapping ones.
 */
function mergeErrorsIntoAnr(work: WorkingHypothesis[]): WorkingHypothesis[] {
  const anrIdx = work.findIndex(
    (h) => h.hypothesisKey === 'anr::risk' && h.confidence === 'high',
  );
  if (anrIdx < 0) { return work; }

  // Collect all error-recent evidence line IDs into the ANR hypothesis.
  const errorIds: number[] = [];
  for (const h of work) {
    if (h.templateId === 'error-recent') {
      errorIds.push(...h.evidenceLineIds);
    }
  }
  if (errorIds.length === 0) { return work; }

  const anr = work[anrIdx];
  const merged = new Set([...anr.evidenceLineIds, ...errorIds]);
  const ids = Array.from(merged).filter((n) => n >= 0).slice(0, MAX_EVIDENCE_IDS);
  const updated: WorkingHypothesis = { ...anr, evidenceLineIds: ids };

  return work.map((h, i) => {
    if (i === anrIdx) { return updated; }
    // Remove error-recent — their evidence now lives in the ANR hypothesis.
    return h;
  }).filter((h) => h.templateId !== 'error-recent');
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
    confidenceReason: h.confidenceReason,
    hypothesisKey: h.hypothesisKey,
  };
}

/** Single source of truth for hypothesis generation. */
export function buildHypotheses(bundle: RootCauseHintBundle): RootCauseHypothesis[] {
  if (!bundle || (bundle.bundleVersion !== 1 && bundle.bundleVersion !== 2)) {
    return [];
  }
  if (!isRootCauseHintsEligible(bundle)) {
    return [];
  }

  const n1List = bundle.nPlusOneHints;
  const n1Fingerprints = new Set<string>();
  if (n1List) {
    for (const h of n1List) {
      if (h?.fingerprint) { n1Fingerprints.add(h.fingerprint); }
    }
  }

  const parts: WorkingHypothesis[] = [
    ...errorHypotheses(bundle),
    ...diffHypotheses(bundle, MAX_TEXT_LEN),
    ...nPlusOneHypotheses(n1List, MAX_TEXT_LEN),
    ...sqlBurstHypotheses(bundle, MAX_TEXT_LEN),
    ...driftHypotheses(bundle, MAX_TEXT_LEN),
    ...fingerprintLeaderHypotheses(bundle.fingerprintLeaders, n1Fingerprints, MAX_TEXT_LEN),
    // v2 general signals
    ...warningHypotheses(bundle, MAX_TEXT_LEN),
    ...networkHypotheses(bundle, MAX_TEXT_LEN),
    ...memoryHypotheses(bundle, MAX_TEXT_LEN),
    ...slowOpHypotheses(bundle, MAX_TEXT_LEN),
    ...permissionHypotheses(bundle, MAX_TEXT_LEN),
    ...classifiedErrorHypotheses(bundle, MAX_TEXT_LEN),
    ...anrHypotheses(bundle, MAX_TEXT_LEN),
  ];

  const merged = mergeErrorsIntoAnr(dedupeAndMerge(parts));
  merged.sort((a, b) => {
    if (a.tier !== b.tier) { return a.tier - b.tier; }
    return a.hypothesisKey.localeCompare(b.hypothesisKey);
  });

  return merged.slice(0, MAX_BULLETS).map(stripWorking);
}
