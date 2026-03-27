/**
 * User-facing failure handling when Explain with AI cannot call the Language Model API.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import type { AIContext } from './ai-context-builder';
import { buildExplainErrorPrompt } from './ai-prompt';

/** Matches the message thrown from ai-explain when vscode.lm has no chat models. */
export function isNoChatModelErrorMessage(message: string): boolean {
    return message.includes('No AI model available');
}

function errorToMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return 'Unknown error';
    }
}

/** Show error; if no LM is registered, offer copying the prompt for Cursor / Claude / external chat. */
export async function showAiExplainRunFailure(context: AIContext, err: unknown): Promise<void> {
    const message = errorToMessage(err);
    if (isNoChatModelErrorMessage(message)) {
        const copy = t('action.copyAiPrompt');
        const open = t('action.openAiSettings');
        const choice = await vscode.window.showErrorMessage(t('msg.aiExplainNoModel'), copy, open);
        if (choice === copy) {
            await vscode.env.clipboard.writeText(buildExplainErrorPrompt(context));
            void vscode.window.showInformationMessage(t('msg.aiExplainPromptCopied'));
        } else if (choice === open) {
            void vscode.commands.executeCommand('workbench.action.openSettings', 'saropaLogCapture.ai');
        }
        return;
    }
    void vscode.window.showErrorMessage(t('msg.aiExplainError', message));
}
