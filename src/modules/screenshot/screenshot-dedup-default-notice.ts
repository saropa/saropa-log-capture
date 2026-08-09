import * as vscode from 'vscode';
import { t } from '../../l10n';

/**
 * One-time notice that `skipNearDuplicates` now defaults to on (flipped 2026-08-08). The setting
 * discards a capture the user would otherwise have kept, so a silent default change is exactly the
 * kind of "why did my capture count drop" question a CHANGELOG line alone does not answer for
 * someone who never reads one. Modeled on `nls-coverage-notice.ts` — same one-time `globalState`
 * gate, same "never block activation" contract.
 *
 * Fires ONLY for a user who never touched the setting in either direction: `inspect()` (not `get()`)
 * is what makes that distinguishable — `get()` cannot tell "resolved to the schema default" apart
 * from "the user explicitly chose the value the schema default happens to match".
 */

const SETTING_ID = 'saropaLogCapture.integrations.screenshots.skipNearDuplicates';
const noticeShownKey = 'slc.skipNearDuplicatesDefaultNoticeShown';

/**
 * True when nothing at any scope (workspace folder, workspace, or user) set this key explicitly.
 * Exported and typed against the plain shape `inspect()` returns (not `vscode.WorkspaceConfiguration`
 * itself) so it unit-tests with a plain object literal, no Extension Host required.
 *
 * A missing `inspected` (VS Code found nothing to inspect for this key at all — not expected for a
 * real registered setting, but not ruled out either) reads as FALSE, not true: this function's only
 * caller uses it to decide whether to notify, and the safe failure mode for "cannot determine
 * whether this was touched" is silence, not a notice that might be wrong.
 */
export function isUntouched(inspected?: {
    readonly globalValue?: unknown; readonly workspaceValue?: unknown; readonly workspaceFolderValue?: unknown;
}): boolean {
    return inspected !== undefined
        && inspected.globalValue === undefined
        && inspected.workspaceValue === undefined
        && inspected.workspaceFolderValue === undefined;
}

/**
 * Show the notice at most once, ever, and only to a user the default flip actually changed
 * behavior for. Safe to call on every activation: returns immediately once shown, or for anyone
 * who has an explicit value in either direction. Never throws — activation must not be blocked.
 */
export function maybeNotifySkipNearDuplicatesDefaultChanged(context: vscode.ExtensionContext): void {
    if (context.globalState.get<boolean>(noticeShownKey)) { return; }

    const inspected = vscode.workspace.getConfiguration().inspect<boolean>(SETTING_ID);
    if (!isUntouched(inspected)) { return; }

    void context.globalState.update(noticeShownKey, true);

    const openSetting = t('action.openSetting');
    void vscode.window.showInformationMessage(t('screenshot.dedupDefaultNotice'), openSetting)
        .then(choice => {
            if (choice === openSetting) {
                void vscode.commands.executeCommand('workbench.action.openSettings', SETTING_ID);
            }
        });
}
