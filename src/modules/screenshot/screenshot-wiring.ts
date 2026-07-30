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
import { clamp } from '../config/config-validation';
import { ScreenshotCapturer, type ManualCaptureOutcome } from './screenshot-capturer';
import { ScreenshotStore, type ScreenshotSaveResult } from './screenshot-store';
import { captureVmServiceScreenshot } from './vm-service-screenshot';
import { captureAdbScreenshot } from './adb-screenshot';
import { makeCaptureTransport } from './screenshot-transport';
import { getLatestVmServiceWsUri, recordVmServiceUriFromLogLine, registerVmServiceUriTracking } from './vm-service-uri';
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
            // Clamp to the package.json ranges: raw .get() skips getConfig()'s validation, and
            // a hand-edited settings.json value (e.g. maxPerLog 0) would otherwise silently
            // disable capture while the menu UI shows the clamped number.
            cooldownMs: clamp(cfg().get('integrations.screenshots.cooldownMs'), 250, 60000, 2000),
            maxPerLog: clamp(cfg().get('integrations.screenshots.maxPerLog'), 1, 500, 50),
        }),
        getVmServiceWsUri: getLatestVmServiceWsUri,
        // VM first (chrome-free where it still exists), adb screencap fallback — the path
        // that works on modern Flutter, where _flutter.screenshot is gone. Device serial
        // follows the adb-logcat setting (blank = default device), read fresh per capture.
        capturePng: makeCaptureTransport({
            vm: captureVmServiceScreenshot,
            adb: () => captureAdbScreenshot(cfg().get<string>('integrations.adbLogcat.device', '').trim()),
            log: deps.log,
        }),
        store,
        onSaved: deps.onSaved,
        log: deps.log,
    });

    registerVmServiceUriTracking(deps.context);
    deps.sessionManager.addLineListener((data) => {
        // Fallback URI discovery from the console banner — regex runs ONLY while no URI is
        // known (one boolean check per line otherwise), so the firehose cost stays near zero.
        if (!data.isMarker && data.logFileUri && !getLatestVmServiceWsUri()) {
            recordVmServiceUriFromLogLine(data.text, data.logFileUri);
        }
        capturer.onLine(data);
    });
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
        case 'busy': return vscode.window.showInformationMessage(t('msg.screenshotBusy'));
        case 'failed': return vscode.window.showWarningMessage(t('msg.screenshotFailed'));
    }
}
