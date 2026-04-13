/**
 * General (non-SQL) hypothesis generators for the signals feature.
 *
 * Each function takes a `RootCauseHintBundle` and returns `WorkingHypothesis[]`.
 * Text is actionable — includes the actual problem detail, not generic templates.
 */

import type {
  RootCauseHintBundle,
  RootCauseHypothesisConfidence,
} from './root-cause-hint-types';
import {
  ROOT_CAUSE_ANR_MIN_SCORE,
  ROOT_CAUSE_SLOW_OP_MIN_MS,
  ROOT_CAUSE_WARNING_MIN_COUNT,
} from './root-cause-hint-eligibility';
import { excerptKey, truncateText } from './build-hypotheses-text';

/** Hypothesis priority tier: 0 = critical, 1 = normal, 2 = low-priority. */
export type Tier = 0 | 1 | 2;

export interface WorkingHypothesis {
  readonly templateId: string;
  readonly text: string;
  readonly evidenceLineIds: readonly number[];
  readonly confidence?: RootCauseHypothesisConfidence;
  readonly hypothesisKey: string;
  readonly tier: Tier;
}

/** Recurring warnings grouped by text. */
export function warningHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const groups = bundle.warningGroups;
  if (!groups || groups.length === 0) { return []; }
  const out: WorkingHypothesis[] = [];
  for (const g of groups) {
    if (!g || g.count < ROOT_CAUSE_WARNING_MIN_COUNT) { continue; }
    out.push({
      templateId: 'warning-recurring',
      text: truncateText(`Warning repeated ${g.count}x: ${g.excerpt}`, maxLen),
      evidenceLineIds: g.lineIndices.slice(0, 8),
      confidence: 'medium',
      hypothesisKey: `warn::${excerptKey(g.excerpt)}`,
      tier: 1,
    });
  }
  return out.slice(0, 3);
}

/** Network/connectivity failures. */
export function networkHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const failures = bundle.networkFailures;
  if (!failures || failures.length === 0) { return []; }
  const groups = new Map<string, { excerpt: string; lines: number[] }>();
  for (const f of failures) {
    if (!f) { continue; }
    const key = f.pattern;
    const g = groups.get(key);
    if (g) { g.lines.push(f.lineIndex); }
    else { groups.set(key, { excerpt: f.excerpt, lines: [f.lineIndex] }); }
  }
  const out: WorkingHypothesis[] = [];
  for (const [key, { excerpt, lines }] of groups) {
    const suffix = lines.length > 1 ? ` (${lines.length} occurrences)` : '';
    out.push({
      templateId: 'network-failure',
      text: truncateText(`Network failure: ${excerpt}${suffix}`, maxLen),
      evidenceLineIds: lines.slice(0, 8),
      confidence: 'medium',
      hypothesisKey: `net::${key}`,
      tier: 1,
    });
  }
  return out.slice(0, 3);
}

/** Memory pressure or OOM events. */
export function memoryHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const events = bundle.memoryEvents;
  if (!events || events.length === 0) { return []; }
  const lines = events.map(e => e.lineIndex);
  const first = events[0];
  const suffix = events.length > 1 ? ` (${events.length} occurrences)` : '';
  return [{
    templateId: 'memory-pressure',
    text: truncateText(`Memory pressure: ${first.excerpt}${suffix}`, maxLen),
    evidenceLineIds: lines.slice(0, 8),
    confidence: 'high',
    hypothesisKey: `mem::${excerptKey(first.excerpt)}`,
    tier: 0,
  }];
}

/** Slow operations exceeding threshold. */
export function slowOpHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const ops = bundle.slowOperations;
  if (!ops || ops.length === 0) { return []; }
  const qualifying = ops.filter(o => o.durationMs >= ROOT_CAUSE_SLOW_OP_MIN_MS);
  if (qualifying.length === 0) { return []; }
  const sorted = qualifying.slice().sort((a, b) => b.durationMs - a.durationMs);
  const out: WorkingHypothesis[] = [];
  for (const op of sorted.slice(0, 3)) {
    const sec = (op.durationMs / 1000).toFixed(1);
    out.push({
      templateId: 'slow-operation',
      text: truncateText(`Slow operation (${sec}s): ${op.excerpt}`, maxLen),
      evidenceLineIds: [op.lineIndex],
      confidence: 'low',
      hypothesisKey: `slow::${excerptKey(op.excerpt)}`,
      tier: 2,
    });
  }
  return out;
}

/** Permission denials. */
export function permissionHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const denials = bundle.permissionDenials;
  if (!denials || denials.length === 0) { return []; }
  const lines = denials.map(d => d.lineIndex);
  const first = denials[0];
  const suffix = denials.length > 1 ? ` (${denials.length} occurrences)` : '';
  return [{
    templateId: 'permission-denial',
    text: truncateText(`Permission denied: ${first.excerpt}${suffix}`, maxLen),
    evidenceLineIds: lines.slice(0, 8),
    confidence: 'medium',
    hypothesisKey: `perm::${excerptKey(first.excerpt)}`,
    tier: 1,
  }];
}

/** Classified errors (critical, bug). */
export function classifiedErrorHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const classified = bundle.classifiedErrors;
  if (!classified || classified.length === 0) { return []; }
  const groups = new Map<string, { excerpt: string; lines: number[] }>();
  for (const c of classified) {
    if (!c) { continue; }
    const g = groups.get(c.classification);
    if (g) { g.lines.push(c.lineIndex); }
    else { groups.set(c.classification, { excerpt: c.excerpt, lines: [c.lineIndex] }); }
  }
  const out: WorkingHypothesis[] = [];
  for (const [cls, { excerpt, lines }] of groups) {
    const conf: RootCauseHypothesisConfidence = cls === 'critical' ? 'high' : 'medium';
    const tier: Tier = cls === 'critical' ? 0 : 1;
    const suffix = lines.length > 1 ? ` (${lines.length} occurrences)` : '';
    out.push({
      templateId: `classified-${cls}`,
      text: truncateText(`${capitalize(cls)} error: ${excerpt}${suffix}`, maxLen),
      evidenceLineIds: lines.slice(0, 8),
      confidence: conf,
      hypothesisKey: `cls::${cls}`,
      tier,
    });
  }
  return out;
}

/** ANR risk from host-side scorer. */
export function anrHypotheses(bundle: RootCauseHintBundle, maxLen: number): WorkingHypothesis[] {
  const anr = bundle.anrRisk;
  if (!anr || anr.score < ROOT_CAUSE_ANR_MIN_SCORE) { return []; }
  const detail = anr.signals.length > 0 ? ` — ${anr.signals.join(', ')}` : '';
  const conf: RootCauseHypothesisConfidence = anr.score > 50 ? 'high' : 'medium';
  return [{
    templateId: 'anr-risk',
    text: truncateText(`ANR risk: ${anr.level} (score ${anr.score})${detail}`, maxLen),
    evidenceLineIds: [],
    confidence: conf,
    hypothesisKey: 'anr::risk',
    tier: 0,
  }];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
