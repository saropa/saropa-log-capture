/**
 * Collection-related viewer messages (request list, open by id, create with name).
 * Extracted to keep viewer-message-handler.ts under the line limit.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { CollectionStore } from "../../modules/collection/collection-store";
import { showCollectionPanel } from "../collection/collection-panel";
import type { ViewerMessageContext } from "./viewer-message-types";

/** Build collectionsList payload from store (for posting to webview). */
export async function getCollectionsListPayload(store: CollectionStore): Promise<{
  type: "collectionsList";
  collections: { id: string; name: string; sourceCount: number; isActive: boolean; updatedAt?: number }[];
  activeId: string | undefined;
}> {
  const collections = await store.listCollections();
  const activeId = await store.getActiveCollectionId();
  return {
    type: "collectionsList",
    collections: collections.map((inv) => ({
      id: inv.id,
      name: inv.name,
      sourceCount: inv.sources.length,
      isActive: inv.id === activeId,
      updatedAt: inv.updatedAt,
    })),
    activeId: activeId ?? undefined,
  };
}

/** Build and post collectionsList payload from store. */
export async function postCollectionsList(ctx: ViewerMessageContext, store: CollectionStore): Promise<void> {
  const payload = await getCollectionsListPayload(store);
  ctx.post(payload);
}

/**
 * Handle collection-related messages. Returns true if the message was handled.
 */
export function dispatchCollectionMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  switch (msg.type) {
    case "requestCollections":
      void (async () => {
        const store = new CollectionStore(ctx.context);
        await postCollectionsList(ctx, store);
      })();
      return true;
    case "openCollectionById":
      void (async () => {
        const id = String(msg.id ?? "");
        if (!id) { return; }
        const store = new CollectionStore(ctx.context);
        await store.setActiveCollectionId(id);
        await showCollectionPanel(store);
      })();
      return true;
    case "createCollectionWithName": {
      const name = String(msg.name ?? "").trim();
      if (!name) {
        ctx.post({ type: "createCollectionError", message: t("validation.nameRequired") });
        return true;
      }
      if (name.length > 100) {
        ctx.post({ type: "createCollectionError", message: t("validation.nameTooLong") });
        return true;
      }
      void (async () => {
        const store = new CollectionStore(ctx.context);
        try {
          const collection = await store.createCollection({ name });
          await store.setActiveCollectionId(collection.id);
          await showCollectionPanel(store);
          await postCollectionsList(ctx, store);
          ctx.post({ type: "createCollectionSucceeded", id: collection.id });
          vscode.window.showInformationMessage(t("msg.collectionCreated", name));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          ctx.post({ type: "createCollectionError", message });
        }
      })();
      return true;
    }
    case "renameCollection": {
      const id = String(msg.id ?? "");
      const name = String(msg.name ?? "").trim();
      /* Validate: non-empty and within length limit (client enforces too) */
      if (!id || !name || name.length > 100) { return true; }
      void (async () => {
        const store = new CollectionStore(ctx.context);
        await store.updateName(id, name);
        await postCollectionsList(ctx, store);
        ctx.post({ type: "collectionRenamed" });
      })();
      return true;
    }
    case "mergeCollections": {
      const sourceId = String(msg.sourceId ?? "");
      const targetId = String(msg.targetId ?? "");
      if (!sourceId || !targetId || sourceId === targetId) { return true; }
      void (async () => {
        try {
          const store = new CollectionStore(ctx.context);
          await store.mergeCollections(sourceId, targetId);
          await postCollectionsList(ctx, store);
          ctx.post({ type: "collectionsMerged" });
          vscode.window.showInformationMessage(t("msg.collectionsMerged"));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          vscode.window.showErrorMessage(message);
        }
      })();
      return true;
    }
    case "deleteCollectionConfirm": {
      const id = String(msg.id ?? "");
      if (!id) { return true; }
      void (async () => {
        const store = new CollectionStore(ctx.context);
        const collection = await store.getCollection(id);
        if (!collection) { return; }
        const confirm = await vscode.window.showWarningMessage(
          t("msg.deleteCollectionConfirm", collection.name),
          { modal: true },
          t("action.delete"),
        );
        if (confirm !== t("action.delete")) { return; }
        await store.deleteCollection(id);
        await postCollectionsList(ctx, store);
        ctx.post({ type: "collectionDeleted" });
        vscode.window.showInformationMessage(t("msg.collectionDeleted", collection.name));
      })();
      return true;
    }
    default:
      return false;
  }
}
