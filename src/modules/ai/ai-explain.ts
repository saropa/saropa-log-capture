/**
 * Call VS Code Language Model API to explain an error from AIContext.
 * Supports caching (Phase 3) and model preference.
 */

import * as vscode from 'vscode';
import type { AIContext } from './ai-context-builder';
import { buildExplainErrorPrompt } from './ai-prompt';
import { getCachedExplanation, setCachedExplanation } from './ai-cache';

export interface ExplainResult {
    explanation: string;
    model: string;
    cached: boolean;
}

/**
 * Request an explanation from an available chat model.
 * Uses cache when saropaLogCapture.ai.cacheExplanations is true; respects modelPreference.
 * Throws if no model is available.
 */
export async function explainError(
    context: AIContext,
    options: { useCache?: boolean } = {},
): Promise<ExplainResult> {
    const useCache = options.useCache ?? true;
    if (useCache) {
        const cached = getCachedExplanation(context);
        if (cached) { return cached; }
    }

    const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
    const preference = (aiCfg.get<string>('modelPreference', '') || '').trim().toLowerCase();
    const selector = preference ? { vendor: preference } : undefined;
    const models = await Promise.resolve(vscode.lm.selectChatModels(selector)).catch(() => []);
    const fallbackModels = selector && models.length === 0
        ? await Promise.resolve(vscode.lm.selectChatModels()).catch(() => [])
        : models;
    const model = fallbackModels[0];

    if (!model) {
        throw new Error(
            'No AI model available. This editor must expose at least one Language Model API chat model (e.g. GitHub Copilot Chat). '
                + 'Some Cursor setups do not; use "Copy prompt for external chat" when offered.',
        );
    }

    const prompt = buildExplainErrorPrompt(context);
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    // Cancellation could be wired to panel close or a cancel button; token is passed for future use.
    const cts = new vscode.CancellationTokenSource();
    const response = await model.sendRequest(messages, {}, cts.token);
    let explanation = '';
    for await (const chunk of response.text) {
        explanation += chunk;
    }
    const modelLabel = typeof (model as { name?: string }).name === 'string' ? (model as { name: string }).name : (model as { id?: string }).id ?? 'model';
    const result: ExplainResult = { explanation: explanation.trim(), model: modelLabel, cached: false };

    if (useCache) { setCachedExplanation(context, result); }
    return result;
}
