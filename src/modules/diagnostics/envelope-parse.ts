/**
 * Parse + validate a Saropa Diagnostic Envelope from raw JSON text (R2, consume side).
 * Pure — no fs — so the lenient-but-safe validation is unit-testable.
 *
 * Robustness contract (plan Risks + Test Plan): a sibling file that is absent, truncated,
 * malformed, or from a higher schema major must never throw into the host. This parser
 * returns `undefined` for an unreadable envelope and silently drops individual malformed
 * diagnostics rather than rejecting the whole file (forward-compatibility: a newer sibling
 * may add diagnostic kinds this consumer does not understand).
 */

import {
  type Diagnostic,
  type DiagnosticCategory,
  type DiagnosticEnvelope,
  type DiagnosticSeverity,
  type DiagnosticSource,
  isReadableSchema,
} from './saropa-diagnostic-envelope';

const SOURCES: ReadonlySet<string> = new Set<DiagnosticSource>(['lints', 'advisor', 'log-capture']);
const SEVERITIES: ReadonlySet<string> = new Set<DiagnosticSeverity>(['error', 'warning', 'info']);
const CATEGORIES: ReadonlySet<string> = new Set<DiagnosticCategory>([
  'drift', 'security', 'performance', 'crash', 'schema', 'data', 'a11y', 'other',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Coerce one raw entry into a Diagnostic, or `undefined` if it lacks the required
 * identity/severity/category fields. Unknown extra fields are ignored (Section 2.4).
 * Optional fields are passed through only when present and the right primitive type,
 * so a malformed `location`/`fix` degrades to absent rather than corrupting the row.
 */
export function parseDiagnostic(raw: unknown): Diagnostic | undefined {
  if (!isObject(raw)) {
    return undefined;
  }
  const { id, source, severity, category, title } = raw;
  if (typeof id !== 'string' || typeof title !== 'string') {
    return undefined;
  }
  if (!SOURCES.has(source as string) || !SEVERITIES.has(severity as string) || !CATEGORIES.has(category as string)) {
    return undefined;
  }
  return {
    id,
    source: source as DiagnosticSource,
    severity: severity as DiagnosticSeverity,
    category: category as DiagnosticCategory,
    title,
    detail: optionalString(raw.detail),
    ruleId: optionalString(raw.ruleId),
    location: parseLocation(raw.location),
    sql: optionalString(raw.sql),
    table: optionalString(raw.table),
    fix: parseFix(raw.fix),
    docUri: optionalString(raw.docUri),
    commitSha: optionalString(raw.commitSha),
    timestamp: optionalString(raw.timestamp),
  };
}

function parseLocation(raw: unknown): Diagnostic['location'] {
  if (!isObject(raw)) {
    return undefined;
  }
  return {
    file: optionalString(raw.file),
    line: typeof raw.line === 'number' ? raw.line : undefined,
    column: typeof raw.column === 'number' ? raw.column : undefined,
    uri: optionalString(raw.uri),
  };
}

function parseFix(raw: unknown): Diagnostic['fix'] {
  if (!isObject(raw)) {
    return undefined;
  }
  const { kind, title } = raw;
  // A fix without a kind+title is unusable; drop it rather than render a blank action.
  if ((kind !== 'quickFix' && kind !== 'command' && kind !== 'doc') || typeof title !== 'string') {
    return undefined;
  }
  return {
    kind,
    title,
    command: optionalString(raw.command),
    args: Array.isArray(raw.args) ? raw.args : undefined,
    uri: optionalString(raw.uri),
  };
}

/**
 * Parse raw file text into a validated envelope, or `undefined` when the text is not
 * JSON, is not an envelope, or declares a schema major this consumer cannot read.
 * Individual malformed diagnostics are dropped; the rest are returned.
 */
export function parseEnvelope(text: string): DiagnosticEnvelope | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isObject(raw) || !isReadableSchema(raw.schemaVersion) || !Array.isArray(raw.diagnostics)) {
    return undefined;
  }
  const producer = isObject(raw.producer) ? raw.producer : {};
  const diagnostics = raw.diagnostics
    .map(parseDiagnostic)
    .filter((d): d is Diagnostic => d !== undefined);
  return {
    schemaVersion: raw.schemaVersion as number,
    producer: {
      name: optionalString(producer.name) ?? 'unknown',
      version: optionalString(producer.version) ?? '0.0.0',
    },
    generatedAt: optionalString(raw.generatedAt) ?? '',
    diagnostics,
  };
}
