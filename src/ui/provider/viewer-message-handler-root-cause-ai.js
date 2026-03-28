"use strict";
/**
 * Viewer "Explain signals with AI" (DB_14). Split from viewer-message-handler-actions for max-lines.
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
exports.runExplainRootCauseHypotheses = runExplainRootCauseHypotheses;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const ai_context_builder_1 = require("../../modules/ai/ai-context-builder");
const ai_explain_1 = require("../../modules/ai/ai-explain");
const ai_explain_panel_1 = require("../panels/ai-explain-panel");
const viewer_message_handler_panels_1 = require("./viewer-message-handler-panels");
const ai_enable_scope_1 = require("../../modules/ai/ai-enable-scope");
const ai_explain_ui_1 = require("../../modules/ai/ai-explain-ui");
function msgStr(m, key, fallback = "") {
    const v = m[key];
    return typeof v === "string" ? v : fallback;
}
/** User-triggered: explain deterministic root-cause hypothesis bullets with the same AI path as line explain. */
function runExplainRootCauseHypotheses(msg, ctx) {
    const uri = ctx.currentFileUri;
    const text = msgStr(msg, "text").trim();
    const lineIdx = (0, viewer_message_handler_panels_1.safeLineIndex)(msg.lineIndex, 0);
    if (!uri || !text) {
        return;
    }
    const aiCfg = vscode.workspace.getConfiguration("saropaLogCapture.ai");
    if (!aiCfg.get("enabled", false)) {
        const enableLabel = (0, l10n_1.t)("action.enable");
        vscode.window.showInformationMessage((0, l10n_1.t)("msg.aiExplainDisabled"), enableLabel).then(async (choice) => {
            if (choice === enableLabel) {
                await aiCfg.update("enabled", true, (0, ai_enable_scope_1.getAiEnabledConfigurationTarget)());
                runExplainRootCauseHypotheses(msg, ctx);
            }
        }, () => { });
        return;
    }
    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)("msg.aiExplainHypothesesProgress"), cancellable: false }, async () => {
        let builtContext;
        try {
            const contextLines = Math.max(0, Math.min(50, aiCfg.get("contextLines", 10)));
            const includeIntegrationData = aiCfg.get("includeIntegrationData", true);
            const cacheExplanations = aiCfg.get("cacheExplanations", true);
            builtContext = await (0, ai_context_builder_1.buildAIContext)(uri, lineIdx, text, { contextLines, includeIntegrationData });
            const result = await (0, ai_explain_1.explainError)(builtContext, { useCache: cacheExplanations });
            const explanation = result.explanation;
            const suffix = result.cached ? (0, l10n_1.t)("panel.aiExplainCached") : "";
            const toShow = (explanation.length > 500 ? explanation.slice(0, 497) + "…" : explanation) + suffix;
            const choice = await vscode.window.showInformationMessage(toShow, "Copy", "Show details");
            if (choice === "Copy") {
                vscode.env.clipboard.writeText(explanation).then(undefined, () => { });
            }
            if (choice === "Show details") {
                (0, ai_explain_panel_1.showAIExplanationPanel)(builtContext, result);
            }
        }
        catch (err) {
            if (builtContext) {
                await (0, ai_explain_ui_1.showAiExplainRunFailure)(builtContext, err);
            }
            else {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage((0, l10n_1.t)("msg.aiExplainError", message)).then(undefined, () => { });
            }
        }
    });
}
//# sourceMappingURL=viewer-message-handler-root-cause-ai.js.map