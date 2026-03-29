/**
 * Prep checks when an integration is enabled. Runs lightweight validation and
 * reports to the user if something is missing (e.g. Crashlytics needs gcloud + config).
 */

import * as vscode from 'vscode';
import { getFirebaseContext } from '../crashlytics/firebase-crashlytics';
import { isAdbAvailable } from './adb-logcat-capture';

/** Check if Crashlytics is ready and return an issue string if not. */
async function checkCrashlyticsPrep(): Promise<string | undefined> {
    try {
        const ctx = await getFirebaseContext([]);
        if (!ctx || !ctx.available) {
            const hint = ctx?.setupHint ?? 'Check Output for Saropa Crashlytics.';
            return `Crashlytics: ${hint}`;
        }
    } catch {
        return 'Crashlytics: prep check failed; open the Crashlytics panel for details.';
    }
    return undefined;
}

/** Run prep checks for the given adapter ids and show a single message about issues. Never throws. */
export async function runIntegrationPrepCheck(adapterIds: string[]): Promise<void> {
    try {
        if (!Array.isArray(adapterIds) || adapterIds.length === 0) { return; }
        const ids = adapterIds.filter((id): id is string => typeof id === 'string');
        const issues: string[] = [];
        if (ids.includes('crashlytics')) {
            const issue = await checkCrashlyticsPrep();
            if (issue) { issues.push(issue); }
        }
        if (ids.includes('adbLogcat') && !isAdbAvailable()) {
            issues.push('adb Logcat: `adb` not found on PATH. Install Android SDK Platform-Tools.');
        }
        if (issues.length > 0) {
            void vscode.window.showWarningMessage(
                issues.length === 1 ? issues[0] : `Integration setup:\n${issues.join('\n')}`,
                { modal: false },
            );
        }
    } catch {
        // Never surface prep failure to the user as a crash
    }
}
