/**
 * DB_12: “possible static sources” for a Drift SQL fingerprint via project index (suggestive only).
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { extractDriftFingerprintSearchTokens } from "../../modules/db/drift-sql-fingerprint-code-tokens";
import { getGlobalProjectIndexer } from "../../modules/project-indexer/project-indexer";

const MAX_PICK = 22;

export async function runFindStaticSourcesForSqlFingerprint(fingerprint: string): Promise<void> {
  const fp = fingerprint.trim();
  if (!fp) {
    return;
  }
  const indexer = getGlobalProjectIndexer();
  if (!indexer) {
    void vscode.window.showInformationMessage(t("msg.staticSqlSourcesNoIndexer"));
    return;
  }
  const tokens = extractDriftFingerprintSearchTokens(fp);
  if (tokens.length === 0) {
    void vscode.window.showInformationMessage(t("msg.staticSqlSourcesNoTokens"));
    return;
  }
  await indexer.getOrRebuild(60_000);
  const ranked = indexer.queryDocEntriesByTokensWithScores(tokens).slice(0, MAX_PICK);
  if (ranked.length === 0) {
    void vscode.window.showInformationMessage(t("msg.staticSqlSourcesNoMatches", tokens.join(", ")));
    return;
  }
  const items = ranked.map((r) => ({
    label: `${r.score}\u2003${r.doc.relativePath}`,
    description: t("msg.staticSqlSourcesPickDescription"),
    doc: r.doc,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: t("msg.staticSqlSourcesPickTitle", tokens.join(", ")),
    placeHolder: t("msg.staticSqlSourcesPickPlaceholder"),
  });
  if (!picked) {
    return;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(picked.doc.uri));
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    const headings = picked.doc.headings;
    const pos =
      headings.length > 0
        ? new vscode.Position(Math.max(0, headings[0].line - 1), 0)
        : new vscode.Position(0, 0);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(pos, pos);
  } catch {
    void vscode.window.showWarningMessage(t("msg.staticSqlSourcesOpenFailed"));
  }
}
