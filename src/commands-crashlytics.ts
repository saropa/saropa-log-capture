/** Command registration for Crashlytics panel. */

import * as vscode from 'vscode';
import { showCrashlyticsPanel, refreshCrashlyticsPanel } from './ui/crashlytics-panel';

/** Register Crashlytics commands. */
export function crashlyticsCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showCrashlytics',
            () => { showCrashlyticsPanel().catch(() => {}); },
        ),
        vscode.commands.registerCommand(
            'saropaLogCapture.refreshCrashlytics',
            () => { refreshCrashlyticsPanel().catch(() => {}); },
        ),
    ];
}
