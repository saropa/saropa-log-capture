/**
 * Serialize Log Capture's internal recurring signals into Saropa Diagnostic Envelope
 * diagnostics (R1, produce side). Pure — no VS Code, no clock, no fs — so the mapping
 * (severity, category, crash signature, SQL/table extraction) is unit-testable in
 * isolation. The writer module supplies the clock, producer version, and file I/O.
 */

import type { RecurringSignalEntry, SignalKind, SignalSeverity } from '../misc/recurring-signal-builder';
import {
  type Diagnostic,
  type DiagnosticCategory,
  type DiagnosticEnvelope,
  type DiagnosticSeverity,
  type EnvelopeProducer,
  DIAGNOSTIC_SCHEMA_VERSION,
  LOG_CAPTURE_SOURCE,
} from './saropa-diagnostic-envelope';
import { crashSignatureRuleId, deriveCrashSignature } from './crash-signature';

/** Per-session context the signal itself does not carry. */
export interface SerializeContext {
  /** HEAD at capture time, stamped on every diagnostic for cross-commit correlation. */
  readonly commitSha?: string;
}

/** Crash categories recorded on a signal (from `classifyCategory`). These are always crashes. */
const CRASH_CATEGORIES: ReadonlySet<string> = new Set(['fatal', 'anr', 'oom', 'native']);

/**
 * Map Log Capture's four-level internal severity onto the suite's three-level triple.
 * `critical`/`high` are both "this broke something" → `error`; `medium` → `warning`;
 * `low` → `info`. Collapsing two levels into `error` is deliberate: the boundary speaks
 * the common three, and the original four-level value stays inside Log Capture.
 */
export function mapSeverity(severity: SignalSeverity): DiagnosticSeverity {
  if (severity === 'critical' || severity === 'high') {
    return 'error';
  }
  if (severity === 'medium') {
    return 'warning';
  }
  return 'info';
}

/**
 * Map a signal's kind + crash category to the shared problem domain. A recognized crash
 * (by category or by a derived text signature) always wins, then SQL → `drift`,
 * timing/IO kinds → `performance`, permission → `security`; everything else is `other`.
 */
export function mapCategory(kind: SignalKind, signalCategory: string | undefined, isCrash: boolean): DiagnosticCategory {
  if (isCrash || kind === 'anr' || (signalCategory !== undefined && CRASH_CATEGORIES.has(signalCategory))) {
    return 'crash';
  }
  if (kind === 'sql') {
    return 'drift';
  }
  if (kind === 'perf' || kind === 'slow-op' || kind === 'network' || kind === 'memory') {
    return 'performance';
  }
  if (kind === 'permission') {
    return 'security';
  }
  return 'other';
}

/**
 * Pull the table name out of a normalized SQL fingerprint so table-scoped consumers
 * (Advisor's schema/EXPLAIN) can target it. Normalization preserves identifiers, so the
 * first table after FROM/INTO/UPDATE/JOIN is reliable. Returns undefined when not found.
 */
function extractTable(sql: string | undefined): string | undefined {
  if (!sql) {
    return undefined;
  }
  const match = /\b(?:from|into|update|join)\s+["'`]?([A-Za-z_]\w*)/i.exec(sql);
  return match?.[1];
}

/**
 * The SQL text for a signal, when it is a DB signal. The SQL `kind` stores the
 * normalized query as its `fingerprint` (see `accumulateSql`); other kinds carry none.
 */
function extractSql(entry: RecurringSignalEntry): string | undefined {
  return entry.kind === 'sql' ? entry.fingerprint : undefined;
}

/** Convert one recurring signal into a shared-shape diagnostic. */
export function signalToDiagnostic(entry: RecurringSignalEntry, ctx: SerializeContext): Diagnostic {
  // Crash-family signature drives both the category and the ruleId Lints maps against.
  // Match against label + detail since either may carry the exception text.
  const crashSig = deriveCrashSignature(`${entry.label}\n${entry.detail ?? ''}`);
  const isCrash = crashSig !== undefined;
  const sql = extractSql(entry);

  return {
    // Stable dedupe key: kind namespaces the raw fingerprint so an error hash and a SQL
    // pattern that happen to collide as strings still produce distinct ids.
    id: `${entry.kind}:${entry.fingerprint}`,
    source: LOG_CAPTURE_SOURCE,
    severity: mapSeverity(entry.severity),
    category: mapCategory(entry.kind, entry.category, isCrash),
    title: entry.label,
    detail: entry.detail,
    // Only crash diagnostics get a ruleId here — it is the cross-tool contract Lints
    // consumes. Log Capture never fabricates a Lints/Advisor rule id for other kinds.
    ruleId: crashSig ? crashSignatureRuleId(crashSig) : undefined,
    sql,
    table: extractTable(sql),
    commitSha: ctx.commitSha,
  };
}

/**
 * Categories Log Capture produces in v1 — the ones where a sibling tool has a
 * counterpart (Drift/SQL ↔ Advisor + Lints; crash ↔ Lints; slow query ↔ the Drift
 * Health loop). Broader categories are deferred (see plan Scope). Filtering here keeps
 * the offline mirror small and on-contract rather than dumping every internal signal.
 */
const V1_CATEGORIES: ReadonlySet<DiagnosticCategory> = new Set<DiagnosticCategory>(['drift', 'crash', 'performance']);

/** True when a diagnostic is in the v1 produce scope. */
export function isInScopeV1(diagnostic: Diagnostic): boolean {
  return V1_CATEGORIES.has(diagnostic.category);
}

/**
 * Serialize a signal list to in-scope diagnostics. Out-of-scope categories are dropped
 * (see {@link isInScopeV1}); pass `includeAll` to bypass the filter for testing or a
 * future full export.
 */
export function signalsToDiagnostics(
  entries: readonly RecurringSignalEntry[],
  ctx: SerializeContext,
  includeAll = false,
): Diagnostic[] {
  const all = entries.map((entry) => signalToDiagnostic(entry, ctx));
  return includeAll ? all : all.filter(isInScopeV1);
}

/** Assemble a complete envelope. `generatedAt` is injected so this stays clock-free. */
export function buildEnvelope(
  diagnostics: readonly Diagnostic[],
  producer: EnvelopeProducer,
  generatedAt: string,
): DiagnosticEnvelope {
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    producer,
    generatedAt,
    diagnostics,
  };
}
