"use strict";
/**
 * Investigation-related viewer messages (request list, open by id, create with name).
 * Extracted to keep viewer-message-handler.ts under the line limit.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvestigationsListPayload = getInvestigationsListPayload;
exports.postInvestigationsList = postInvestigationsList;
exports.dispatchInvestigationMessage = dispatchInvestigationMessage;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const investigation_store_1 = require("../../modules/investigation/investigation-store");
const investigation_panel_1 = require("../investigation/investigation-panel");
/** Build investigationsList payload from store (for posting to webview). */
async function getInvestigationsListPayload(store) {
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
async function postInvestigationsList(ctx, store) {
    const payload = await getInvestigationsListPayload(store);
    ctx.post(payload);
}
/**
 * Handle investigation-related messages. Returns true if the message was handled.
 */
function dispatchInvestigationMessage(msg, ctx) {
    switch (msg.type) {
        case "requestInvestigations":
            void (async () => {
                const store = new investigation_store_1.InvestigationStore(ctx.context);
                await postInvestigationsList(ctx, store);
            })();
            return true;
        case "openInvestigationById":
            void (async () => {
                const id = String(msg.id ?? "");
                if (!id) {
                    return;
                }
                const store = new investigation_store_1.InvestigationStore(ctx.context);
                await store.setActiveInvestigationId(id);
                await (0, investigation_panel_1.showInvestigationPanel)(store);
            })();
            return true;
        case "createInvestigationWithName": {
            const name = String(msg.name ?? "").trim();
            if (!name) {
                ctx.post({ type: "createInvestigationError", message: (0, l10n_1.t)("validation.nameRequired") });
                return true;
            }
            if (name.length > 100) {
                ctx.post({ type: "createInvestigationError", message: (0, l10n_1.t)("validation.nameTooLong") });
                return true;
            }
            void (async () => {
                const store = new investigation_store_1.InvestigationStore(ctx.context);
                try {
                    const investigation = await store.createInvestigation({ name });
                    await store.setActiveInvestigationId(investigation.id);
                    await (0, investigation_panel_1.showInvestigationPanel)(store);
                    await postInvestigationsList(ctx, store);
                    ctx.post({ type: "createInvestigationSucceeded", id: investigation.id });
                    vscode.window.showInformationMessage((0, l10n_1.t)("msg.investigationCreated", name));
                }
                catch (e) {
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
//# sourceMappingURL=viewer-message-handler-investigation.js.map