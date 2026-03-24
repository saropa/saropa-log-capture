/**
 * Load Drift Advisor summary for the Performance → Database tab (DB_13): session meta plus optional sidecar.
 * @see plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md
 */

import * as path from "node:path";
import * as vscode from "vscode";
import { DRIFT_ADVISOR_META_KEY } from "./drift-advisor-constants";
import { mergeDriftAdvisorDbPanelPayload } from "./drift-advisor-db-panel-payload";

export { mergeDriftAdvisorDbPanelPayload } from "./drift-advisor-db-panel-payload";

/**
 * Read `{logBase}.drift-advisor.json` next to the log file and merge with `integrations['saropa-drift-advisor']`.
 */
export async function loadDriftAdvisorDbPanelPayload(
  logUri: vscode.Uri,
  integrations: Record<string, unknown> | undefined,
): Promise<unknown | null> {
  const fromMeta = integrations?.[DRIFT_ADVISOR_META_KEY];
  let sidecar: Record<string, unknown> | null = null;
  try {
    const dir = path.dirname(logUri.fsPath);
    const baseName = path.basename(logUri.fsPath, path.extname(logUri.fsPath));
    const scPath = path.join(dir, `${baseName}.drift-advisor.json`);
    const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(scPath));
    const parsed = JSON.parse(Buffer.from(raw).toString("utf-8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      sidecar = parsed as Record<string, unknown>;
    }
  } catch {
    // Sidecar is optional; invalid JSON is ignored.
  }
  return mergeDriftAdvisorDbPanelPayload(fromMeta, sidecar);
}
