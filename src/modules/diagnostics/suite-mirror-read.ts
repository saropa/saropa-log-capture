/**
 * Read the sibling offline mirrors for the SQL Query History panel (R2 render, data-source
 * slice). Returns the typed `Diagnostic[]` from `.saropa/diagnostics/advisor.json` and
 * `lints.json`, narrowed to the DB-relevant categories the panel surfaces.
 *
 * This is the *fallback* source: the panel still prefers Drift Advisor's live debug-server
 * fetch and the live Saropa Lints export when those are available (they are fresher than a
 * mirror written at an earlier point — see the plan's stale-mirror risk). The mirror fills
 * the section only when the live source is absent (server not running / no live export).
 */

import { type Diagnostic, type DiagnosticCategory } from './saropa-diagnostic-envelope';
import { readSiblingEnvelope } from './envelope-io';

/** Typed mirror diagnostics, split by which panel section renders them. */
export interface SuiteMirrorDiagnostics {
  /** Drift Advisor diagnostics → the panel's "Database issues" section. */
  readonly advisor: readonly Diagnostic[];
  /** Saropa Lints diagnostics → the panel's "Static code issues" section. */
  readonly lints: readonly Diagnostic[];
}

/**
 * Categories the SQL panel is about — DB data/schema and the query-performance angle. A
 * sibling envelope may carry unrelated categories (a Lints a11y finding, say); those are
 * not for this panel, so they are filtered out here rather than rendered out of context.
 */
const DB_RELEVANT: ReadonlySet<DiagnosticCategory> = new Set<DiagnosticCategory>([
  'drift', 'schema', 'data', 'performance',
]);

function dbRelevant(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => DB_RELEVANT.has(d.category));
}

/**
 * Read both sibling mirrors and return their DB-relevant diagnostics. Absent or malformed
 * files yield empty arrays (the reader never throws), so the panel simply shows nothing
 * from the mirror in that case — the same as having no live data.
 */
export async function readSuiteMirrorsForPanel(): Promise<SuiteMirrorDiagnostics> {
  const [advisorEnv, lintsEnv] = await Promise.all([
    readSiblingEnvelope('advisor'),
    readSiblingEnvelope('lints'),
  ]);
  return {
    advisor: dbRelevant(advisorEnv?.diagnostics ?? []),
    lints: dbRelevant(lintsEnv?.diagnostics ?? []),
  };
}
