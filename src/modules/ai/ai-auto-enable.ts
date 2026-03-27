/**
 * Turn on Explain with AI when the editor exposes at least one LM chat model and the user
 * has never explicitly set saropaLogCapture.ai.enabled (still at default / unset).
 */

import * as vscode from 'vscode';

export function scheduleMaybeAutoEnableAiFromLanguageModels(): void {
    void (async () => {
        try {
            const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
            const inspected = aiCfg.inspect<boolean>('enabled');
            const userTouched =
                inspected?.globalValue !== undefined ||
                inspected?.workspaceValue !== undefined ||
                inspected?.workspaceFolderValue !== undefined;
            if (userTouched) {
                return;
            }
            const models = await Promise.resolve(vscode.lm.selectChatModels()).catch(() => []);
            if (models.length > 0) {
                await aiCfg.update('enabled', true, vscode.ConfigurationTarget.Global);
            }
        } catch {
            /* activation must never fail */
        }
    })();
}
