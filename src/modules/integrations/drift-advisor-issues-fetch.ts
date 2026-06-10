/**
 * Best-effort `GET /api/issues` against a running Drift Advisor debug server (plan **DB_18 Phase 2**).
 *
 * Surfaces the server's merged issue list — index suggestions and data anomalies — in the SQL Query
 * History dashboard. Shapes match Drift Advisor's `analytics_handler.dart` getIssuesList():
 *   { issues: [ { source, severity, table, message, suggestedSql?, column?, priority?, type?, count? } ] }
 * or { error: "..." } on failure. The fetch degrades silently: an unreachable server yields ok=false
 * and the dashboard simply hides the issues section.
 *
 * `normalizeDriftDbIssues` is pure (no network) so the field-mapping is unit-testable against the
 * documented schema without a live server.
 */

const ISSUES_TIMEOUT_MS = 3000;

/** Cap so a pathological server response cannot flood the webview payload. */
const MAX_DRIFT_DB_ISSUES = 200;

/** One normalized issue row for the dashboard. Mirrors a Drift Advisor `/api/issues` entry. */
export interface DriftDbIssue {
  /** 'index-suggestion' | 'anomaly' (Drift Advisor's `source`). */
  readonly source: string;
  /** 'warning' | 'info' (already mapped from priority on the server). */
  readonly severity: string;
  readonly table: string;
  readonly message: string;
  readonly suggestedSql?: string;
  readonly column?: string;
  readonly priority?: string;
}

export interface DriftDbIssuesResult {
  readonly ok: boolean;
  readonly issues: readonly DriftDbIssue[];
  readonly error?: string;
}

/** Read one optional string field, returning undefined for missing / non-string / empty values. */
function optStr(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Map one raw issue object to the normalized shape; null when it lacks a usable message. */
function normalizeOneIssue(raw: unknown): DriftDbIssue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const message = optStr(o, "message");
  if (!message) {
    return null;
  }
  return {
    source: optStr(o, "source") ?? "issue",
    severity: optStr(o, "severity") ?? "info",
    table: optStr(o, "table") ?? "",
    message,
    ...(optStr(o, "suggestedSql") ? { suggestedSql: optStr(o, "suggestedSql") } : {}),
    ...(optStr(o, "column") ? { column: optStr(o, "column") } : {}),
    ...(optStr(o, "priority") ? { priority: optStr(o, "priority") } : {}),
  };
}

/** Pure: extract and normalize the issue list from a parsed `/api/issues` body. */
export function normalizeDriftDbIssues(body: unknown): DriftDbIssue[] {
  if (!body || typeof body !== "object") {
    return [];
  }
  const list = (body as { issues?: unknown }).issues;
  if (!Array.isArray(list)) {
    return [];
  }
  const out: DriftDbIssue[] = [];
  for (const raw of list) {
    const issue = normalizeOneIssue(raw);
    if (issue) {
      out.push(issue);
    }
    if (out.length >= MAX_DRIFT_DB_ISSUES) {
      break;
    }
  }
  return out;
}

/** GET /api/issues with a short timeout; never throws (returns ok=false with the error string). */
export async function fetchDriftDbIssues(baseUrl: string): Promise<DriftDbIssuesResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/issues`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ISSUES_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, issues: [], error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as unknown;
    const err = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
    if (typeof err === "string") {
      return { ok: false, issues: [], error: err };
    }
    return { ok: true, issues: normalizeDriftDbIssues(body) };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, issues: [], error: e instanceof Error ? e.message : String(e) };
  }
}
