/**
 * Drift static-code lint violations for the SQL History dashboard (plan **DB_18 Phase 3**).
 *
 * Complements the runtime Drift Advisor issues (Phase 2): Saropa Lints analyzes the Dart SOURCE and
 * ships ~32 Drift rules (`avoid_drift_update_without_where`, `require_drift_database_close`, …). We
 * read its violations export — via the Saropa Lints extension API when present, else
 * `reports/.saropa_lints/violations.json` — and keep only Drift-rule findings.
 *
 * The Drift rule pack is OFF by default in Saropa Lints. When the project clearly uses Drift (the
 * panel has captured Drift SQL) but the export shows no Drift-rule findings, that is the signal to
 * advise turning the pack on. Best-effort throughout: a missing extension/export degrades to "no
 * findings" and (when Drift is in use) the enable-pack suggestion.
 */

import * as vscode from "vscode";
import { SAROPA_LINTS_EXTENSION_ID, type SaropaLintsApi } from "./saropa-lints-api";
import { readExportFile, type RawExport, type RawViolation } from "./lint-violation-reader-io";

/** Cap so a huge export cannot flood the webview payload. */
const MAX_DRIFT_LINT_VIOLATIONS = 200;

/** Drift-pack rule names all contain "drift" (avoid_drift_*, require_drift_*, …). */
const DRIFT_RULE_RE = /drift/i;

/** One Drift static-rule violation for the dashboard. */
export interface DriftLintViolation {
  readonly rule: string;
  readonly message: string;
  readonly file: string;
  readonly line: number;
  readonly severity: string;
}

export interface DriftLintResult {
  /** True when a Saropa Lints export was found (extension API or file). */
  readonly hasExport: boolean;
  readonly violations: readonly DriftLintViolation[];
  /** True when the project uses Drift but no Drift-rule findings exist → suggest enabling the pack. */
  readonly suggestEnablePack: boolean;
  readonly tier?: string;
}

/** Read the violations export from the Saropa Lints extension API (sync, in-memory) when available. */
function getExportViaApi(): RawExport | undefined {
  const ext = vscode.extensions.getExtension<SaropaLintsApi>(SAROPA_LINTS_EXTENSION_ID);
  const api = ext?.exports;
  if (!api || typeof api.getViolationsData !== "function") {
    return undefined;
  }
  try {
    const data = api.getViolationsData();
    return data ? (data as unknown as RawExport) : undefined;
  } catch {
    return undefined;
  }
}

/** API first (no disk read), then the on-disk export. */
async function getLintExport(wsRoot: vscode.Uri): Promise<RawExport | undefined> {
  return getExportViaApi() ?? (await readExportFile(wsRoot));
}

/** Strip the conventional `[rule] ` prefix Saropa Lints prepends to messages. */
function stripRulePrefix(message: string, rule: string): string {
  const prefix = `[${rule}] `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/** Map a raw violation to a Drift violation, or null when it is not a Drift rule / lacks a message. */
function toDriftViolation(v: RawViolation): DriftLintViolation | null {
  if (!v.rule || !v.message || !DRIFT_RULE_RE.test(v.rule)) {
    return null;
  }
  return {
    rule: v.rule,
    message: stripRulePrefix(v.message, v.rule),
    file: v.file ?? "",
    line: v.line ?? 0,
    severity: v.severity ?? "info",
  };
}

/**
 * Pure: build the result from an export (or its absence). No Lints export → suggest setup only when
 * the project uses Drift; export present → keep Drift-rule findings and advise enabling the pack when
 * Drift is used but produced no findings (the pack is off by default). Exported for unit tests.
 */
export function buildDriftLintResult(
  raw: RawExport | undefined,
  usesDrift: boolean,
): DriftLintResult {
  if (!raw) {
    return { hasExport: false, violations: [], suggestEnablePack: usesDrift };
  }
  const violations: DriftLintViolation[] = [];
  for (const v of raw.violations ?? []) {
    const dv = toDriftViolation(v);
    if (dv) {
      violations.push(dv);
    }
    if (violations.length >= MAX_DRIFT_LINT_VIOLATIONS) {
      break;
    }
  }
  return {
    hasExport: true,
    violations,
    suggestEnablePack: usesDrift && violations.length === 0,
    tier: raw.config?.tier,
  };
}

/**
 * Collect Drift-rule violations and decide whether to advise enabling the Drift pack.
 * @param usesDrift - the caller's signal that the project uses Drift (e.g. captured Drift SQL exists).
 */
export async function getDriftLintViolations(
  wsRoot: vscode.Uri,
  usesDrift: boolean,
): Promise<DriftLintResult> {
  return buildDriftLintResult(await getLintExport(wsRoot), usesDrift);
}
