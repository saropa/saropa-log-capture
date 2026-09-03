/**
 * Viewer "Explain signals with AI" (DB_14). Split from viewer-message-handler-actions for max-lines.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { buildAIContext } from "../../modules/ai/ai-context-builder";
import { explainError } from "../../modules/ai/ai-explain";
import { showAIExplanationPanel } from "../panels/ai-explain-panel";
import { safeLineIndex } from "./viewer-message-handler-panels";
import type { ViewerMessageContext } from "./viewer-message-types";
import { getAiEnabledConfigurationTarget } from "../../modules/ai/ai-enable-scope";
import { showAiExplainRunFailure, confirmAiDataConsent } from "../../modules/ai/ai-explain-ui";

function msgStr(m: Record<string, unknown>, key: string, fallback = ""): string {
  const v = m[key];
  return typeof v === "string" ? v : fallback;
}

/** User-triggered: explain deterministic root-cause hypothesis bullets with the same AI path as line explain. */
export function runExplainRootCauseHypotheses(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
  const uri = ctx.currentFileUri;
  const text = msgStr(msg, "text").trim();
  const lineIdx = safeLineIndex(msg.lineIndex, 0);
  if (!uri || !text) { return; }
  const aiCfg = vscode.workspace.getConfiguration("saropaLogCapture.ai");
  if (!aiCfg.get<boolean>("enabled", false)) {
    const enableLabel = t("action.enable");
    vscode.window.showInformationMessage(t("msg.aiExplainDisabled"), enableLabel).then(async (choice) => {
      if (choice === enableLabel) {
        await aiCfg.update("enabled", true, getAiEnabledConfigurationTarget());
        runExplainRootCauseHypotheses(msg, ctx);
      }
    }, () => {});
    return;
  }
  // bug_003: this path bypassed the consent dialog entirely — it calls buildAIContext directly
  // (same data volume as "Explain with AI") but had no confirmAiDataConsent() gate, so root-cause
  // hypotheses were sent to the model with zero user confirmation. Mirror runExplainWithAi's gate.
  confirmAiDataConsent().then((consented) => {
    if (consented) { runExplainRootCauseHypothesesConfirmed(msg, ctx, aiCfg); }
  }, () => {});
}

/** Continuation of runExplainRootCauseHypotheses after consent is granted. */
function runExplainRootCauseHypothesesConfirmed(
  msg: Record<string, unknown>, ctx: ViewerMessageContext, aiCfg: vscode.WorkspaceConfiguration,
): void {
  const uri = ctx.currentFileUri;
  const text = msgStr(msg, "text").trim();
  const lineIdx = safeLineIndex(msg.lineIndex, 0);
  if (!uri || !text) { return; }
  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t("msg.aiExplainHypothesesProgress"), cancellable: false },
    async () => {
      let builtContext: Awaited<ReturnType<typeof buildAIContext>> | undefined;
      try {
        const contextLines = Math.max(0, Math.min(50, aiCfg.get<number>("contextLines", 10)));
        const includeIntegrationData = aiCfg.get<boolean>("includeIntegrationData", true);
        const cacheExplanations = aiCfg.get<boolean>("cacheExplanations", true);
        builtContext = await buildAIContext(uri, lineIdx, text, { contextLines, includeIntegrationData });
        const result = await explainError(builtContext, { useCache: cacheExplanations });
        const explanation = result.explanation;
        const suffix = result.cached ? t("panel.aiExplainCached") : "";
        const toShow = (explanation.length > 500 ? explanation.slice(0, 497) + "…" : explanation) + suffix;
        const choice = await vscode.window.showInformationMessage(toShow, "Copy", "Show details");
        if (choice === "Copy") { vscode.env.clipboard.writeText(explanation).then(undefined, () => {}); }
        if (choice === "Show details") { showAIExplanationPanel(builtContext, result); }
      } catch (err) {
        if (builtContext) {
          await showAiExplainRunFailure(builtContext, err);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(t("msg.aiExplainError", message)).then(undefined, () => {});
        }
      }
    },
  );
}
