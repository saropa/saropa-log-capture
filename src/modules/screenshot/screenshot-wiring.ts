/**
 * Activation wiring for debug screenshot capture (plan 114). Kept out of
 * extension-activation.ts for the line limit: builds the capturer with live deps,
 * registers the line listener, the VM-Service URI tracking, and the manual command.
 *
 * Settings are read one key at a time (not getConfig()) because onLine runs on the
 * live capture firehose and getConfig() rebuilds all ~256 settings per call — the
 * same trade the error snackbar documents.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { ScreenshotCapturer, type ManualCaptureOutcome } from './screenshot-capturer';
import { ScreenshotStore, type ScreenshotSaveResult } from './screenshot-store';
import { captureVmServiceScreenshot } from './vm-service-screenshot';
import { getLatestVmServiceWsUri, registerVmServiceUriTracking } from './vm-service-uri';
import type { SessionManagerImpl } from '../session/session-manager';

/** What the rest of the extension needs back from the wiring. */
export interface ScreenshotRuntime {
    readonly capturer: ScreenshotCapturer;
    readonly store: ScreenshotStore;
}

interface ScreenshotWiringDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly log: (message: string) => void;
    /** Fan-out for UI surfaces (footer counter, viewer icons) after each save. */
    readonly onSaved: (logFsPath: string, result: ScreenshotSaveResult) => void;
}

/** Build + register the screenshot pipeline. Called once at activation. */
export function registerScreenshotCapture(deps: ScreenshotWiringDeps): ScreenshotRuntime {
    const store = new ScreenshotStore();
    const cfg = (): vscode.WorkspaceConfiguration =>
        vscode.workspace.getConfiguration('saropaLogCapture');
    const capturer = new ScreenshotCapturer({
        isEnabled: () => cfg().get<boolean>('integrations.screenshots.enabled', true),
        triggerSettings: () => ({
            onError: cfg().get<boolean>('integrations.screenshots.onError', true),
            onWarning: cfg().get<boolean>('integrations.screenshots.onWarning', false),
            onNavigation: cfg().get<boolean>('integrations.screenshots.onNavigation', false),
            cooldownMs: cfg().get<number>('integrations.screenshots.cooldownMs', 2000),
            maxPerLog: cfg().get<number>('integrations.screenshots.maxPerLog', 50),
        }),
        getVmServiceWsUri: getLatestVmServiceWsUri,
        capturePng: captureVmServiceScreenshot,
        store,
        onSaved: deps.onSaved,
        log: deps.log,
    });

    registerVmServiceUriTracking(deps.context);
    deps.sessionManager.addLineListener((data) => capturer.onLine(data));
    deps.context.subscriptions.push(
        vscode.commands.registerCommand('saropaLogCapture.captureScreenshot', () =>
            runManualCapture(capturer, deps.sessionManager),
        ),
    );
    return { capturer, store };
}

/** Manual command: capture against the active log, then toast the outcome (no silent async). */
async function runManualCapture(capturer: ScreenshotCapturer, sessionManager: SessionManagerImpl): Promise<void> {
    const session = sessionManager.getActiveSession();
    if (!session) {
        void vscode.window.showInformationMessage(t('msg.screenshotNoLog'));
        return;
    }
    const outcome = await capturer.captureManual(session.fileUri.fsPath, session.lineCount);
    void showManualOutcome(outcome);
}

/** Map a manual-capture outcome to its user-facing message. */
function showManualOutcome(outcome: ManualCaptureOutcome): Thenable<string | undefined> {
    switch (outcome) {
        case 'saved': return vscode.window.showInformationMessage(t('msg.screenshotSaved'));
        case 'disabled': return vscode.window.showInformationMessage(t('msg.screenshotDisabled'));
        case 'noVmService': return vscode.window.showInformationMessage(t('msg.screenshotNoVmService'));
        case 'capFull': return vscode.window.showWarningMessage(t('msg.screenshotCapFull'));
        case 'failed': return vscode.window.showWarningMessage(t('msg.screenshotFailed'));
    }
}
