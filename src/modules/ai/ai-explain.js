"use strict";
/**
 * Call VS Code Language Model API to explain an error from AIContext.
 * Supports caching (Phase 3) and model preference.
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
exports.explainError = explainError;
const vscode = __importStar(require("vscode"));
const ai_prompt_1 = require("./ai-prompt");
const ai_cache_1 = require("./ai-cache");
/**
 * Request an explanation from an available chat model.
 * Uses cache when saropaLogCapture.ai.cacheExplanations is true; respects modelPreference.
 * Throws if no model is available.
 */
async function explainError(context, options = {}) {
    const useCache = options.useCache ?? true;
    if (useCache) {
        const cached = (0, ai_cache_1.getCachedExplanation)(context);
        if (cached) {
            return cached;
        }
    }
    const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
    const preference = (aiCfg.get('modelPreference', '') || '').trim().toLowerCase();
    const selector = preference ? { vendor: preference } : undefined;
    const models = await Promise.resolve(vscode.lm.selectChatModels(selector)).catch(() => []);
    const fallbackModels = selector && models.length === 0
        ? await Promise.resolve(vscode.lm.selectChatModels()).catch(() => [])
        : models;
    const model = fallbackModels[0];
    if (!model) {
        throw new Error('No AI model available. This editor must expose at least one Language Model API chat model (e.g. GitHub Copilot Chat). '
            + 'Some Cursor setups do not; use "Copy prompt for external chat" when offered.');
    }
    const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(context);
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    // Cancellation could be wired to panel close or a cancel button; token is passed for future use.
    const cts = new vscode.CancellationTokenSource();
    const response = await model.sendRequest(messages, {}, cts.token);
    let explanation = '';
    for await (const chunk of response.text) {
        explanation += chunk;
    }
    const modelLabel = typeof model.name === 'string' ? model.name : model.id ?? 'model';
    const result = { explanation: explanation.trim(), model: modelLabel, cached: false };
    if (useCache) {
        (0, ai_cache_1.setCachedExplanation)(context, result);
    }
    return result;
}
//# sourceMappingURL=ai-explain.js.map