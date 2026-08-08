/**
 * One command that answers "what is the screenshot pipeline actually doing right now".
 *
 * Every number here already existed, but only as a one-time notice emitted at the moment it
 * happened — "captures are idle", "this capture could not be read", "a kept capture nearly matched".
 * A reader who missed the line, or who arrived after it, had no way to ask. That is why those
 * notices kept accumulating: each new silent state needed its own announcement. This asks instead.
 *
 * Rendered as plain text into the output channel rather than a webview: it is meant to be read once,
 * copied into a bug report, and forgotten.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import type { ScreenshotCapturer } from './screenshot-capturer';
import type { ScreenshotStore } from './screenshot-store';
import { readScreenshotSummary, screenshotDirUri, screenshotSidecarUri } from './screenshot-store';
import type { ScreenshotSettings } from './screenshot-settings';

/** What the report needs to describe the live pipeline. */
export interface ScreenshotDiagnosis {
    readonly capturer: ScreenshotCapturer;
    readonly store: ScreenshotStore;
    /** Log currently being captured to, or undefined when no session is running. */
    readonly logFsPath: string | undefined;
    /**
     * The RESOLVED settings the pipeline is using — not a configuration to read again. A second
     * reading is a report that can show a default for a key that moved, exactly when someone reached
     * for it because they no longer trust the behavior.
     */
    readonly settings: ScreenshotSettings;
    /** Live VM Service address, or undefined — the single most common reason captures never fire. */
    readonly vmServiceUri: string | undefined;
}

/** `yes` / `no`, so a scanning reader can see state without parsing prose. */
function yn(value: boolean): string { return value ? 'yes' : 'no'; }

/** Settings block: what the pipeline was told to do, as it resolved them. */
function settingsLines(s: ScreenshotSettings): string[] {
    return [
        `  enabled:            ${yn(s.enabled)}`,
        `  on error:           ${yn(s.onError)}`,
        `  on warning:         ${yn(s.onWarning)}`,
        `  on navigation:      ${yn(s.onNavigation)}`,
        `  cooldown:           ${s.cooldownMs} ms`,
        `  max per log:        ${s.maxPerLog}`,
        `  skip near-dupes:    ${yn(s.skipNearDuplicates)}`,
        `  similarity:         ${s.duplicateSimilarity}`,
    ];
}

/**
 * Counts block: what actually happened. `onDisk` is read back from the sidecar rather than reported
 * from memory, because the two disagreeing is itself the answer to "why is my count wrong" — a
 * pending write, or a write that failed.
 */
async function countLines(d: ScreenshotDiagnosis): Promise<string[]> {
    if (!d.logFsPath) { return ['  (no session is running, so there is nothing to count)']; }
    const summary = await readScreenshotSummary(d.logFsPath);
    return [
        `  captures kept:      ${d.store.countForLog(d.logFsPath)} this process, ${summary.entries.length} on disk`,
        `  near-dupes skipped: ${d.store.suppressedForLog(d.logFsPath)} this process, ${summary.suppressed} on disk`,
        `  count write queued: ${yn(d.store.hasPendingSuppressed)}`,
        `  logcat crashes held as replay: ${d.capturer.suppressedLogcatCrashes}`,
    ];
}

/** Where block: the paths a reader needs to look at the files themselves. */
function pathLines(logFsPath: string | undefined): string[] {
    if (!logFsPath) { return []; }
    return [
        '',
        'Where:',
        `  log:      ${logFsPath}`,
        `  captures: ${screenshotDirUri(logFsPath).fsPath}`,
        `  sidecar:  ${screenshotSidecarUri(logFsPath).fsPath}`,
    ];
}

/**
 * Build the whole report. Pure string assembly over the passed-in state, so the command layer only
 * has to decide where to show it.
 */
export async function buildScreenshotDiagnosis(d: ScreenshotDiagnosis): Promise<string> {
    return [
        '── Screenshot capture diagnosis ──',
        '',
        'Settings:',
        ...settingsLines(d.settings),
        '',
        'Capture target:',
        `  VM Service known:   ${d.vmServiceUri ? 'yes' : 'no — captures stay idle until a debug session announces one'}`,
        '',
        'Counts:',
        ...(await countLines(d)),
        ...pathLines(d.logFsPath),
        '',
    ].join('\n');
}

/** Show the diagnosis in the output channel, and tell the user where it went. */
export async function runScreenshotDiagnosis(
    d: ScreenshotDiagnosis, log: (message: string) => void, show: () => void,
): Promise<void> {
    // Line by line: the output channel is a line-oriented surface, and one giant write loses the
    // formatting that makes this scannable.
    for (const line of (await buildScreenshotDiagnosis(d)).split('\n')) { log(line); }
    show();
    void vscode.window.showInformationMessage(t('screenshot.diagnosed'));
}
