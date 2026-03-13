/**
 * Proactive Crashlytics status bar: shows "Crashlytics: ready" or
 * "Crashlytics: complete setup in panel" so users see setup state without opening the panel.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getCrashlyticsStatus } from '../../modules/crashlytics/firebase-crashlytics';

const UPDATE_DELAY_MS = 800;

let updateCallback: (() => void) | undefined;

/** Set by extension activation so handlers can trigger a status bar refresh (e.g. after auth). */
export function setCrashlyticsStatusBarUpdateCallback(cb: () => void): void {
    updateCallback = cb;
}

/** Call when Crashlytics data was just refreshed (e.g. after setup step) so status bar stays in sync. */
export function notifyCrashlyticsStatusBarUpdate(): void {
    updateCallback?.();
}

export class CrashlyticsStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private timeout: ReturnType<typeof setTimeout> | undefined;
    private disposed = false;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            'saropaLogCapture.crashlyticsStatus',
            vscode.StatusBarAlignment.Right,
            49,
        );
        this.item.name = 'Saropa Log Capture: Crashlytics';
        this.item.command = 'saropaLogCapture.open';
    }

    /** Call when workspace may have changed (folders, or after a delay on activation). */
    scheduleUpdate(): void {
        if (this.disposed) { return; }
        if (this.timeout) { clearTimeout(this.timeout); }
        this.timeout = setTimeout(() => {
            this.timeout = undefined;
            this.update().catch(() => {});
        }, UPDATE_DELAY_MS);
    }

    private async update(): Promise<void> {
        if (this.disposed) { return; }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            this.item.hide();
            return;
        }
        try {
            const { status } = await getCrashlyticsStatus();
            if (this.disposed) { return; }
            if (status === 'ready') {
                this.item.text = t('statusBar.crashlyticsReady');
                this.item.tooltip = t('statusBar.crashlyticsReady') + '. Click to open log viewer.';
            } else {
                this.item.text = t('statusBar.crashlyticsSetupNeeded');
                this.item.tooltip = t('statusBar.crashlyticsSetupNeeded') + '. Open the log viewer and click the Crashlytics icon.';
            }
            this.item.show();
        } catch {
            this.item.hide();
        }
    }

    dispose(): void {
        this.disposed = true;
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.item.dispose();
    }
}
