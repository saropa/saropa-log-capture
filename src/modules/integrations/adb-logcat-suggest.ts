/**
 * Auto-suggest adb logcat integration when a Dart/Flutter debug session
 * starts and adb is on PATH. Shows a one-time prompt so users discover
 * the feature without hunting through commands.
 */

import * as vscode from 'vscode';
import { isAdbAvailable } from './adb-logcat-capture';

const dismissedKey = 'adbLogcatSuggestionDismissed';
const section = 'saropaLogCapture';
const adaptersKey = 'integrations.adapters';

/** Debug adapter types where logcat is relevant. */
const relevantTypes = new Set(['dart']);

/** Prevents duplicate prompts when multiple sessions start concurrently (e.g. compound launch). */
let promptActive = false;

/** Suggest enabling adb logcat if the session is relevant and adb is available. Never throws. */
export async function suggestAdbLogcatIfRelevant(
    context: vscode.ExtensionContext,
    session: vscode.DebugSession,
): Promise<void> {
    try {
        if (promptActive) { return; }
        if (!relevantTypes.has(session.type)) { return; }
        if (context.workspaceState.get<boolean>(dismissedKey)) { return; }
        const cfg = vscode.workspace.getConfiguration(section);
        if ((cfg.get<string[]>(adaptersKey) ?? []).includes('adbLogcat')) { return; }
        if (!isAdbAvailable()) { return; }

        promptActive = true;
        const enable = 'Enable';
        const dismiss = "Don't Ask Again";
        const choice = await vscode.window.showInformationMessage(
            'adb detected — capture Android logcat alongside your debug session?',
            enable,
            dismiss,
        );
        if (choice === enable) {
            // Re-read adapters to avoid overwriting changes made while the prompt was open.
            const fresh = vscode.workspace.getConfiguration(section);
            const current = fresh.get<string[]>(adaptersKey) ?? [];
            if (!current.includes('adbLogcat')) {
                await fresh.update(adaptersKey, [...current, 'adbLogcat'], vscode.ConfigurationTarget.Workspace);
            }
            vscode.window.showInformationMessage(
                'adb Logcat enabled. It will start with your next debug session.',
            );
        }
        if (choice === enable || choice === dismiss) {
            await context.workspaceState.update(dismissedKey, true);
        }
    } catch {
        // Never surface suggestion failure to the user
    } finally {
        promptActive = false;
    }
}
