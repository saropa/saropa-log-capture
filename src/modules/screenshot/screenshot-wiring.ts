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
import { runScreenshotSelfTest, formatSelfTest } from './screenshot-self-test';
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
    // Failed sidecar writes reach the output channel — a wrong suppressed count is otherwise
    // undiagnosable, and the write no longer happens on a path any caller awaits.
    const store = new ScreenshotStore(deps.log);
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
            skipNearDuplicates: cfg().get<boolean>('integrations.screenshots.skipNearDuplicates', false),
            // Same clamp reasoning: a hand-edited 0 would make every capture a "duplicate" of the
            // one before it and silently stop the gallery filling.
            duplicateSimilarity: clamp(cfg().get('integrations.screenshots.duplicateSimilarity'), 0.5, 0.999, 0.985),
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

    // Build-identity line: the first question in any "no screenshots" report is whether the
    // running extension actually contains this pipeline. Version comes from the manifest —
    // a hardcoded date would silently go stale on the next change to this file.
    const version = vscode.extensions.getExtension('saropa.saropa-log-capture')?.packageJSON?.version ?? 'unknown';
    deps.log(`screenshot: capture pipeline armed (v${version} — VM probe + adb screencap fallback)`);
    registerVmServiceUriTracking(deps.context);
    registerSelfTest(deps, cfg);
    // Threshold observability: the replay gate's constants are reasoned from one observed
    // device. If they are wrong for another, crashes are silently suppressed and the feature
    // looks inert — the exact failure this plan already burned two rounds on. Report the
    // count at session end so a mistuned threshold surfaces as a number.
    deps.context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(() => {
        const suppressed = capturer.suppressedLogcatCrashes;
        if (suppressed > 0) {
            deps.log(`screenshot: ${suppressed} device crash line(s) were treated as replayed history and did not capture — if the app genuinely crashed live, report this count`);
        }
        // Session end is exactly when the near-duplicate count starts being read (a report is
        // generated FROM this log), so the debounced write must not still be pending. This is the
        // guarantee that matters — see the dispose note below for why shutdown is only best-effort.
        void store.flushSuppressed();
    }));
    // Best-effort only: VS Code disposes subscriptions synchronously and does not await a Thenable
    // returned from dispose(), so a window closed mid-session may exit before this write lands. It
    // costs nothing and sometimes helps. The counts that MATTER are already safe by two other
    // routes — the session-terminate flush above, and the fact that every save() rewrites the
    // sidecar from the live count, so any later capture persists what is pending.
    deps.context.subscriptions.push({ dispose: () => { void store.dispose(); } });
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

/** One probe at a time across all sessions (see the coalescing note in the listener). */
let selfTestInFlight = false;

/**
 * Probe capture preconditions once per debug session and record the verdict in BOTH the
 * output channel and the log itself. Writing it into the log is the point: a "no
 * screenshots" report then arrives already carrying its own diagnosis (toggle state,
 * trigger set, adb availability, attached devices) instead of needing a live investigation.
 * The line is appended through the session's ordered write queue, so it lands with the
 * early session output rather than literally inside the header block.
 */
function registerSelfTest(deps: ScreenshotWiringDeps, cfg: () => vscode.WorkspaceConfiguration): void {
    deps.context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
        // Dart/Flutter sessions only. onDidStartDebugSession fires for every debug type, and
        // reporting "adb NOT FOUND / NO DEVICE attached" against a Node or Python session
        // would be actively misleading — screenshots do not apply there at all. Substring
        // rather than exact match: 'dart' is what Dart-Code reports today, but attach/variant
        // types ('dart-attach', 'flutter-web') must not silently lose their self-test.
        if (!/dart|flutter/i.test(session.type)) { return; }
        // Coalesce: a crash-loop or rapid restart fires this repeatedly, and each probe spawns
        // two adb processes. One in-flight probe at a time is plenty for a diagnostic.
        if (selfTestInFlight) { return; }
        selfTestInFlight = true;
        const enabled = cfg().get<boolean>('integrations.screenshots.enabled', true);
        const triggers = [
            cfg().get<boolean>('integrations.screenshots.onError', true) ? 'errors' : '',
            cfg().get<boolean>('integrations.screenshots.onWarning', false) ? 'warnings' : '',
            cfg().get<boolean>('integrations.screenshots.onNavigation', false) ? 'navigation' : '',
        ].filter(Boolean).join('+') || 'none';
        // Fire-and-forget: the probe must never delay session start, and a failed probe is
        // itself reportable information rather than an error worth surfacing to the user.
        void runScreenshotSelfTest(enabled, triggers).then((result) => {
            selfTestInFlight = false;
            const line = formatSelfTest(result);
            deps.log(`screenshot: ${line}`);
            deps.sessionManager.getActiveSession()?.appendHeaderLines([line]);
        }, () => {
            // Probe failed entirely — the armed line already proves the pipeline loaded.
            selfTestInFlight = false;
        });
    }));
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
