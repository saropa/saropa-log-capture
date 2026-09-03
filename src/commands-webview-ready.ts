/**
 * Shared "wait for the sidebar log viewer to resolve" helper (bug_015).
 *
 * `vscode.WebviewViewProvider.resolveWebviewView()` runs asynchronously, some time
 * after VS Code decides to reveal the view — it is NOT guaranteed to have completed by
 * the time `saropaLogCapture.logViewer.focus` returns. A command that posts to the
 * webview immediately after requesting focus can race ahead of that resolution and
 * have `vscode.Webview.postMessage()` silently drop the message into an empty view
 * set (the view simply does not exist yet). Every command that posts to the viewer
 * without first confirming the user already has it open must await this helper.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { LogViewerProvider } from './ui/provider/log-viewer-provider';

/** Poll interval while waiting for resolveWebviewView() to run. */
const pollIntervalMs = 50;
/** Total time budget before giving up — matches the window empirically needed for
 * the sidebar view to resolve after a fresh focus request. */
const defaultTimeoutMs = 1000;

/**
 * Focuses the sidebar log viewer and waits for its WebviewView to resolve.
 *
 * @param viewerProvider - Sidebar viewer whose readiness is being awaited.
 * @param timeoutMs - Max time to wait before giving up.
 * @returns true once a view is resolved, false if the timeout elapsed first.
 */
export async function ensureWebviewReady(
    viewerProvider: LogViewerProvider,
    timeoutMs = defaultTimeoutMs,
): Promise<boolean> {
    // Reveal (or create) the sidebar view. This triggers resolveWebviewView() on the
    // provider, but that callback fires asynchronously — the poll below is still
    // required even after this command finishes.
    await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
    const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
    for (let i = 0; i < maxAttempts && !viewerProvider.getView(); i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return viewerProvider.getView() !== undefined;
}

/**
 * `ensureWebviewReady()` plus a standard "open it first" warning on timeout.
 * Centralizes the not-ready UX so every affected command shows identical messaging
 * instead of each one silently dropping its message (bug_015).
 */
export async function ensureWebviewReadyOrWarn(viewerProvider: LogViewerProvider): Promise<boolean> {
    const ready = await ensureWebviewReady(viewerProvider);
    if (!ready) {
        vscode.window.showWarningMessage(t('msg.openLogViewerFirst'));
    }
    return ready;
}
