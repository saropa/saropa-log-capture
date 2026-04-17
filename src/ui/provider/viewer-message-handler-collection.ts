/**
 * Investigation-related viewer messages (request list, open by id, create with name).
 * Extracted to keep viewer-message-handler.ts under the line limit.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { InvestigationStore } from "../../modules/investigation/investigation-store";
import { showInvestigationPanel } from "../investigation/investigation-panel";
import type { ViewerMessageContext } from "./viewer-message-types";

/** Build investigationsList payload from store (for posting to webview). */
export async function getInvestigationsListPayload(store: InvestigationStore): Promise<{
  type: "investigationsList";
  investigations: { id: string; name: string; sourceCount: number; isActive: boolean; updatedAt?: number }[];
  activeId: string | undefined;
}> {
  const investigations = await store.listInvestigations();
  const activeId = await store.getActiveInvestigationId();
  return {
    type: "investigationsList",
    investigations: investigations.map((inv) => ({
      id: inv.id,
      name: inv.name,
      sourceCount: inv.sources.length,
      isActive: inv.id === activeId,
      updatedAt: inv.updatedAt,
    })),
    activeId: activeId ?? undefined,
  };
}

/** Build and post investigationsList payload from store. */
export async function postInvestigationsList(ctx: ViewerMessageContext, store: InvestigationStore): Promise<void> {
  const payload = await getInvestigationsListPayload(store);
  ctx.post(payload);
}

/**
 * Handle investigation-related messages. Returns true if the message was handled.
 */
export function dispatchInvestigationMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  switch (msg.type) {
    case "requestInvestigations":
      void (async () => {
        const store = new InvestigationStore(ctx.context);
        await postInvestigationsList(ctx, store);
      })();
      return true;
    case "openInvestigationById":
      void (async () => {
        const id = String(msg.id ?? "");
        if (!id) { return; }
        const store = new InvestigationStore(ctx.context);
        await store.setActiveInvestigationId(id);
        await showInvestigationPanel(store);
      })();
      return true;
    case "createInvestigationWithName": {
      const name = String(msg.name ?? "").trim();
      if (!name) {
        ctx.post({ type: "createInvestigationError", message: t("validation.nameRequired") });
        return true;
      }
      if (name.length > 100) {
        ctx.post({ type: "createInvestigationError", message: t("validation.nameTooLong") });
        return true;
      }
      void (async () => {
        const store = new InvestigationStore(ctx.context);
        try {
          const investigation = await store.createInvestigation({ name });
          await store.setActiveInvestigationId(investigation.id);
          await showInvestigationPanel(store);
          await postInvestigationsList(ctx, store);
          ctx.post({ type: "createInvestigationSucceeded", id: investigation.id });
          vscode.window.showInformationMessage(t("msg.investigationCreated", name));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          ctx.post({ type: "createInvestigationError", message });
        }
      })();
      return true;
    }
    default:
      return false;
  }
}
