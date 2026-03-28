"use strict";
/**
 * User-facing failure handling when Explain with AI cannot call the Language Model API.
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
exports.isNoChatModelErrorMessage = isNoChatModelErrorMessage;
exports.showAiExplainRunFailure = showAiExplainRunFailure;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const ai_prompt_1 = require("./ai-prompt");
/** Matches the message thrown from ai-explain when vscode.lm has no chat models. */
function isNoChatModelErrorMessage(message) {
    return message.includes('No AI model available');
}
function errorToMessage(err) {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err);
    }
    catch {
        return 'Unknown error';
    }
}
/** Show error; if no LM is registered, offer copying the prompt for Cursor / Claude / external chat. */
async function showAiExplainRunFailure(context, err) {
    const message = errorToMessage(err);
    if (isNoChatModelErrorMessage(message)) {
        const copy = (0, l10n_1.t)('action.copyAiPrompt');
        const open = (0, l10n_1.t)('action.openAiSettings');
        const choice = await vscode.window.showErrorMessage((0, l10n_1.t)('msg.aiExplainNoModel'), copy, open);
        if (choice === copy) {
            await vscode.env.clipboard.writeText((0, ai_prompt_1.buildExplainErrorPrompt)(context));
            void vscode.window.showInformationMessage((0, l10n_1.t)('msg.aiExplainPromptCopied'));
        }
        else if (choice === open) {
            void vscode.commands.executeCommand('workbench.action.openSettings', 'saropaLogCapture.ai');
        }
        return;
    }
    void vscode.window.showErrorMessage((0, l10n_1.t)('msg.aiExplainError', message));
}
//# sourceMappingURL=ai-explain-ui.js.map