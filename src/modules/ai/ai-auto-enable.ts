/**
 * Offer to turn on Explain with AI when the editor exposes at least one LM chat model and the
 * user has never explicitly set saropaLogCapture.ai.enabled (still at default / unset).
 *
 * Bug 019: this used to write `ai.enabled=true` to global settings on every activation with no
 * notification and no opt-in — a silent capability grant the user never asked for. It now shows a
 * one-time notice (modeled on `screenshot-dedup-default-notice.ts`) and only writes the setting
 * when the user explicitly accepts.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

/** globalState key gating the one-time notice — mirrors the pattern in the screenshot notice. */
const noticeShownKey = 'slc.aiAutoEnableNoticeShown';

/**
 * True when nothing at any scope (workspace folder, workspace, or user) set `ai.enabled`
 * explicitly. Mirrors `isUntouched()` in screenshot-dedup-default-notice.ts: `inspect()` (not
 * `get()`) is required to tell "resolved to the schema default" apart from "the user explicitly
 * chose the value the schema default happens to match".
 */
function isAiEnabledUntouched(inspected?: {
    readonly globalValue?: unknown; readonly workspaceValue?: unknown; readonly workspaceFolderValue?: unknown;
}): boolean {
    return inspected !== undefined
        && inspected.globalValue === undefined
        && inspected.workspaceValue === undefined
        && inspected.workspaceFolderValue === undefined;
}

/**
 * Show the one-time "AI features are available. Enable?" notice and write `ai.enabled=true` only
 * on explicit Accept. Never throws — activation must not be blocked. Requires `context` (added by
 * the bug 019 fix) so the "shown once, ever" state can persist across sessions.
 */
export function scheduleMaybeAutoEnableAiFromLanguageModels(context: vscode.ExtensionContext): void {
    void (async () => {
        try {
            // Never re-show the notice, even to a user who dismissed it without choosing.
            if (context.globalState.get<boolean>(noticeShownKey)) { return; }

            const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
            const inspected = aiCfg.inspect<boolean>('enabled');
            if (!isAiEnabledUntouched(inspected)) { return; }

            const models = await Promise.resolve(vscode.lm.selectChatModels()).catch(() => []);
            if (models.length === 0) { return; }

            // Mark shown before awaiting the user's choice so a second activation racing this one
            // (or a user who dismisses without clicking anything) never triggers the notice twice.
            await context.globalState.update(noticeShownKey, true);

            const accept = t('action.enable');
            const choice = await vscode.window.showInformationMessage(t('ai.autoEnableNotice'), accept, t('action.dismiss'));
            // Only an explicit Accept writes the setting — Dismiss (or closing the toast) leaves
            // AI features off, satisfying the "no silent async" / opt-in requirement.
            if (choice === accept) {
                await aiCfg.update('enabled', true, vscode.ConfigurationTarget.Global);
            }
        } catch {
            /* activation must never fail */
        }
    })();
}
