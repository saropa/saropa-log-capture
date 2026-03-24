/**
 * Pure merge for Drift Advisor DB panel payload (Performance → Database tab, DB_13).
 * Kept separate from `drift-advisor-db-panel-load.ts` so unit tests avoid the `vscode` module.
 * @see plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md
 */

/** Shallow merge: sidecar fills gaps when session meta is partial or missing. */
export function mergeDriftAdvisorDbPanelPayload(
  fromMeta: unknown,
  sidecar: Record<string, unknown> | null,
): unknown | null {
  const base =
    fromMeta && typeof fromMeta === "object" && !Array.isArray(fromMeta)
      ? { ...(fromMeta as Record<string, unknown>) }
      : {};
  if (!sidecar) {
    return Object.keys(base).length ? base : null;
  }
  if (!base.baseUrl && typeof sidecar.baseUrl === "string") {
    base.baseUrl = sidecar.baseUrl;
  }
  const sp = sidecar.performance;
  if (sp && typeof sp === "object" && !Array.isArray(sp) && base.performance === undefined) {
    base.performance = sp;
  }
  return Object.keys(base).length ? base : null;
}
