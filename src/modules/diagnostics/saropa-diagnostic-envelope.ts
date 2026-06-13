/**
 * The Saropa Diagnostic Envelope — the shared cross-tool protocol.
 *
 * Three tools (Saropa Lints = static code, Saropa Drift Advisor = live DB,
 * Saropa Log Capture = runtime telemetry) each emit "a problem with a location,
 * a severity, a source, and maybe a fix." This module is Log Capture's local copy
 * of the one shape they all produce and consume.
 *
 * Canonical definition lives in Drift Advisor's plan (67-saropa-suite-integration.md,
 * Section 2) — Drift Advisor owns the schema; this file conforms to it and must NOT
 * diverge. When the canonical schema changes, mirror it here and bump
 * {@link DIAGNOSTIC_SCHEMA_VERSION} only on a breaking change.
 *
 * Compatibility contract (Section 2.4): consumers ignore unknown fields and refuse a
 * higher major `schemaVersion`; every human-facing string is already localized by the
 * producer (no translation keys cross the boundary); `location.file` is always
 * workspace-relative (never an absolute home path like `C:\Users\<name>\…`).
 */

/** Producer tag — which of the three suite tools emitted a diagnostic. */
export type DiagnosticSource = 'lints' | 'advisor' | 'log-capture';

/**
 * Severity triple shared suite-wide (the set Saropa Lints standardized on).
 * Deliberately NOT Log Capture's internal `critical | high | medium | low` —
 * the boundary speaks the common three; the serializer maps to it.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** Problem domain. `drift` = Drift/SQLite data or schema; the rest are self-describing. */
export type DiagnosticCategory =
  | 'drift'
  | 'security'
  | 'performance'
  | 'crash'
  | 'schema'
  | 'data'
  | 'a11y'
  | 'other';

/** How a `fix` action is carried out. */
export type DiagnosticFixKind = 'quickFix' | 'command' | 'doc';

/**
 * A source location. The `file` is always workspace-relative (Section 2.4) so the
 * envelope never leaks the user's home directory into a file destined for another tool.
 */
export interface DiagnosticLocation {
  /** Workspace-relative path, e.g. `lib/db/app_database.dart`. Never an absolute home path. */
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  /** Used when the target is not a workspace file (a URL, a virtual doc). */
  readonly uri?: string;
}

/**
 * At most one primary action a consumer can offer for a diagnostic.
 * `command` must be one of the documented cross-tool command ids (Section 3) so a
 * click in one extension lands in another — never a private, renameable id.
 */
export interface DiagnosticFix {
  readonly kind: DiagnosticFixKind;
  /** Already-localized button label. */
  readonly title: string;
  /** Contributed VS Code command id (the public deep-link surface). */
  readonly command?: string;
  readonly args?: readonly unknown[];
  readonly uri?: string;
}

/** One problem in the shared shape. Mirrors Section 2.1 exactly. */
export interface Diagnostic {
  /** Stable, product-scoped id used as the dedupe key. */
  readonly id: string;
  readonly source: DiagnosticSource;
  readonly severity: DiagnosticSeverity;
  readonly category: DiagnosticCategory;
  /** One-line, human-facing, already-localized. */
  readonly title: string;
  /** Optional longer body. */
  readonly detail?: string;
  /** Lints rule id, Advisor check id, or Log Capture signal/detector id. */
  readonly ruleId?: string;
  readonly location?: DiagnosticLocation;
  /** Normalized query text, when SQL-related. */
  readonly sql?: string;
  /** Drift / SQLite table name, when table-scoped. */
  readonly table?: string;
  readonly fix?: DiagnosticFix;
  /** Rule/issue documentation. */
  readonly docUri?: string;
  /** For cross-commit correlation (Section 6). */
  readonly commitSha?: string;
  /** ISO 8601, when the diagnostic is event-like. */
  readonly timestamp?: string;
}

/** Identifies which tool + version wrote an envelope. */
export interface EnvelopeProducer {
  readonly name: string;
  readonly version: string;
}

/** The serialized file shape written to `.saropa/diagnostics/<source>.json`. Section 2.2. */
export interface DiagnosticEnvelope {
  readonly schemaVersion: number;
  readonly producer: EnvelopeProducer;
  /** ISO 8601 timestamp the envelope was generated. */
  readonly generatedAt: string;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Current integer schema version. Bump ONLY on a breaking change to the shapes above.
 * A consumer refuses an envelope whose major exceeds this (see {@link isReadableSchema}).
 */
export const DIAGNOSTIC_SCHEMA_VERSION = 1;

/** This tool's producer tag — the value Log Capture stamps on every diagnostic it emits. */
export const LOG_CAPTURE_SOURCE: DiagnosticSource = 'log-capture';

/**
 * Shared workspace folder for offline mirrors. All three tools read/write here so they
 * can correlate without a running server (Advisor's API is debug-only, Lints is
 * compile-time, Log Capture runs whenever the editor is open — rarely all live at once).
 */
export const DIAGNOSTICS_DIR_SEGMENTS = ['.saropa', 'diagnostics'] as const;

/** Offline-mirror filenames, keyed by producing tool. */
export const ENVELOPE_FILENAMES: Readonly<Record<DiagnosticSource, string>> = {
  'lints': 'lints.json',
  'advisor': 'advisor.json',
  'log-capture': 'log-capture.json',
};

/**
 * A consumer accepts any envelope at or below the current major. Unknown future MINOR
 * additions are fine (we ignore unknown fields); a higher MAJOR means an incompatible
 * shape we must not guess at. `schemaVersion` is a single integer here (no minor), so
 * the rule is simply "<= current".
 */
export function isReadableSchema(schemaVersion: unknown): boolean {
  return typeof schemaVersion === 'number'
    && Number.isInteger(schemaVersion)
    && schemaVersion >= 1
    && schemaVersion <= DIAGNOSTIC_SCHEMA_VERSION;
}
