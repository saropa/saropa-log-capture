/**
 * DB_12: “Possible sources (static)” for a Drift SQL fingerprint via project index (suggestive only).
 */

import * as vscode from "vscode";
import { getConfig } from "../../modules/config/config";
import { t } from "../../l10n";
import { buildDriftStaticSqlSearchPlan } from "../../modules/db/drift-sql-static-orm-patterns";
import { buildEnrichedStaticSqlPickList, type EnrichedStaticSqlCandidate } from "../../modules/db/drift-static-sql-candidates";
import { getGlobalProjectIndexer } from "../../modules/project-indexer/project-indexer";

const MAX_PICK = 22;

export async function runFindStaticSourcesForSqlFingerprint(fingerprint: string): Promise<void> {
  if (!getConfig().staticSqlFromFingerprintEnabled) {
    return;
  }
  const fp = fingerprint.trim();
  if (!fp) {
    return;
  }
  const indexer = getGlobalProjectIndexer();
  if (!indexer) {
    void vscode.window.showInformationMessage(t("msg.staticSqlSourcesNoIndexer"));
    return;
  }
  const plan = buildDriftStaticSqlSearchPlan(fp);
  if (plan.indexerTokens.length === 0) {
    void vscode.window.showInformationMessage(t("msg.staticSqlSourcesNoTokens"));
    return;
  }
  await indexer.getOrRebuild(60_000);
  const ranked = indexer.queryDocEntriesByTokensWithScores([...plan.indexerTokens]);
  if (ranked.length === 0) {
    void vscode.window.showInformationMessage(t("msg.staticSqlSourcesNoMatches", plan.indexerTokens.join(", ")));
    return;
  }
  const picks = await buildEnrichedStaticSqlPickList(plan, ranked, MAX_PICK);
  const items = picks.map((c) => staticSqlQuickPickItem(c, plan.indexerTokens.join(", ")));
  const picked = await vscode.window.showQuickPick(items, {
    title: t("msg.staticSqlSourcesPickTitle", plan.indexerTokens.slice(0, 6).join(", ")),
    placeHolder: t("msg.staticSqlSourcesPickPlaceholder"),
  });
  if (!picked) {
    return;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(picked.candidate.doc.uri));
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    const line = Math.max(0, picked.candidate.bestLine1Based - 1);
    const pos = new vscode.Position(line, 0);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(pos, pos);
  } catch {
    void vscode.window.showWarningMessage(t("msg.staticSqlSourcesOpenFailed"));
  }
}

function staticSqlQuickPickItem(
  candidate: EnrichedStaticSqlCandidate,
  tokenSummary: string,
): vscode.QuickPickItem & { candidate: EnrichedStaticSqlCandidate } {
  const loc = `L${candidate.bestLine1Based}`;
  const label = `${loc}\u2003${candidate.doc.relativePath}`;
  const hint = candidate.lineHasPrimaryTableShape ? "yes" : "no";
  return {
    label,
    description: t("msg.staticSqlSourcesPickDescription"),
    detail: t("msg.staticSqlSourcesPickDetail", hint, String(candidate.bestLineTokenHits), tokenSummary),
    candidate,
  };
}
