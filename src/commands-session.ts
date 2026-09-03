/** Session lifecycle, actions, and history browse/edit commands. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig, getLogDirectoryUri } from './modules/config/config';
import type { CommandDeps } from './commands-deps';
import { handleDeleteCommand } from './modules/features/delete-command';
import { cleanupDeletedSessionMetadata } from './modules/session/session-metadata';
import { updateLastViewed } from './ui/provider/viewer-provider-helpers';
import { downloadAndLoadUrl, isDownloadableUrl } from './ui/provider/viewer-url-log';
import type { CaptureToggleStatusBar } from './ui/shared/capture-toggle-status-bar';

/** Show a native file picker scoped to the configured log file types, defaulting to the
 *  log directory. Returns the chosen file URI, or undefined if the user cancelled. */
async function pickLogFile(): Promise<vscode.Uri | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const defaultUri = folder ? getLogDirectoryUri(folder) : undefined;
    // showOpenDialog filters take bare extensions (no leading dot).
    const exts = getConfig().fileTypes.map(e => e.replace(/^\./, '')).filter(Boolean);
    const filters = exts.length > 0
        ? { [t('msg.openLogFile.filter')]: exts, [t('msg.openLogFile.allFiles')]: ['*'] }
        : undefined;
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        defaultUri,
        filters,
        openLabel: t('msg.openLogFile.openLabel'),
    });
    return uris?.[0];
}

/** Prompt for an http/https URL to download a log from. Returns the trimmed URL, or undefined if
 *  cancelled or empty. Validates the scheme inline so the user gets immediate feedback. */
async function promptForLogUrl(): Promise<string | undefined> {
    const url = await vscode.window.showInputBox({
        title: t('msg.urlLog.inputTitle'),
        prompt: t('msg.urlLog.inputPrompt'),
        placeHolder: t('msg.urlLog.inputPlaceholder'),
        validateInput: (v) => (v.trim().length === 0 || isDownloadableUrl(v) ? undefined : t('msg.urlLog.badUrl')),
    });
    const trimmed = url?.trim();
    return trimmed ? trimmed : undefined;
}

export function sessionLifecycleCommands(
    deps: CommandDeps,
    captureToggle: CaptureToggleStatusBar,
): vscode.Disposable[] {
    const { context, sessionManager, viewerProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.toggleCapture', async () => {
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const current = cfg.get<boolean>('enabled', true);
            const newValue = !current;
            /* Capture the active-session count BEFORE writing the setting: the config-change
             * listener stops all sessions asynchronously on flip-off, so reading the count after
             * the write could race that teardown to zero and under-report what was stopped. */
            const stoppedCount = newValue ? 0 : sessionManager.activeSessionCount;
            /* Always write to Global (User) scope, never Workspace. Workspace writes land in
             * .vscode/settings.json, which is typically tracked by git — so a status-bar click
             * was creating an unintended diff and silently disabling capture for every teammate
             * who pulled it (bug_039). The toggle is a personal preference, not a project one. */
            await cfg.update('enabled', newValue, vscode.ConfigurationTarget.Global);
            captureToggle.setEnabled(newValue);
            /* Name what the switch actually did: when disabling stopped live sessions, report the
             * count so the user knows in-flight capture was torn down (not just new sessions gated). */
            const message = newValue
                ? t('captureToggle.enabled')
                : stoppedCount > 0
                    ? t('captureToggle.disabledStoppedSessions', stoppedCount)
                    : t('captureToggle.disabled');
            vscode.window.showInformationMessage(message);
        }),
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !sessionManager.hasSession(active.id)) {
                sessionManager.startSession(active, context);
            } else if (!active) {
                // bug_037: previously silent no-op when the palette command ran with no debug
                // session at all — tell the user what action actually starts a capture.
                void vscode.window.showInformationMessage(t('msg.noActiveCaptureSessionStart'));
            }
            // else: a session already exists for the active debug session — nothing to do,
            // and no message needed since capture is already running as the user expects.
        }),
        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                await sessionManager.stopSession(active);
            } else {
                // bug_037: previously silent no-op — confirm there was nothing to stop.
                void vscode.window.showInformationMessage(t('msg.noActiveCaptureSession'));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const paused = sessionManager.togglePause();
            if (paused !== undefined) {
                viewerProvider.setPaused(paused);
            } else {
                // bug_037: togglePause() returns undefined when there is no recording/paused
                // session to act on — previously silent, now surfaced to the user.
                void vscode.window.showInformationMessage(t('msg.noActiveCaptureSession'));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const s = sessionManager.getActiveSession();
            // Route through openSession (not showTextDocument) so the status bar click
            // opens the log in the viewer webview like every other open-a-log action —
            // showTextDocument dumped raw text into a plain editor tab (bug_038).
            if (s) { await vscode.commands.executeCommand('saropaLogCapture.openSession', { uri: s.fileUri }); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (folder) {
                await vscode.commands.executeCommand('revealFileInOS', getLogDirectoryUri(folder));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            sessionManager.clearActiveSession();
        }),
    ];
}

export function sessionActionCommands(deps: CommandDeps): vscode.Disposable[] {
    const { sessionManager, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.delete', async () => {
            // bug_016: pass the shared metadata store so bulk delete cleans up metadata/
            // search-index entries the same way the single-file and empty-trash paths do.
            await handleDeleteCommand(historyProvider.getMetaStore());
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.insertMarker', async () => {
            // bug_037: check for a session BEFORE prompting — asking the user to type marker
            // text only to silently discard it (insertMarker() is a no-op without a session)
            // was the actual bug; failing fast here also skips a pointless prompt.
            if (!sessionManager.getActiveSession()) {
                void vscode.window.showInformationMessage(t('msg.noActiveCaptureSession'));
                return;
            }
            const text = await vscode.window.showInputBox({
                prompt: t('msg.markerPrompt'),
                placeHolder: t('msg.markerPlaceholder'),
            });
            if (text !== undefined) { sessionManager.insertMarker(text || undefined); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.splitNow', async () => {
            const session = sessionManager.getActiveSession();
            if (!session) {
                vscode.window.showWarningMessage(t('msg.noActiveSessionToSplit'));
                return;
            }
            await session.splitNow();
            historyProvider.refresh();
            vscode.window.showInformationMessage(t('msg.logFileSplit', String(session.partNumber + 1)));
        }),
    ];
}

export function historyBrowseCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.refreshHistory', () => {
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openSession', async (item: { uri: vscode.Uri }) => {
            // bug_013: this command only makes sense on a Logs panel item; when invoked from the
            // Command Palette `item` is undefined and the command used to silently no-op.
            if (!item?.uri) {
                void vscode.window.showInformationMessage(t('msg.paletteRequiresLog'));
                return;
            }
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            await viewerProvider.loadFromFile(item.uri);
            await updateLastViewed(deps.context, item.uri);
        }),
        // Open-a-file entry point: a native picker that loads ANY log directly into the viewer,
        // bypassing the folder-scan session list. Reaches files outside the configured reports
        // directory (e.g. another project's logs) which the list-root browse can't open by path.
        vscode.commands.registerCommand('saropaLogCapture.openLogFile', async () => {
            const uri = await pickLogFile();
            if (!uri) { return; }
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            await viewerProvider.loadFromFile(uri);
            await updateLastViewed(deps.context, uri);
        }),
        // Download a log from a URL into temp storage and render it — for logs shared as a link
        // (CI artifact, gist raw, internal dashboard) without saving them by hand first.
        vscode.commands.registerCommand('saropaLogCapture.openLogFromUrl', async () => {
            const url = await promptForLogUrl();
            if (!url) { return; }
            await downloadAndLoadUrl(url, (uri) => viewerProvider.loadFromFile(uri), deps.context);
        }),
        vscode.commands.registerCommand('saropaLogCapture.replay', async () => {
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            viewerProvider.startReplay();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openTailedFile', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                void vscode.window.showWarningMessage(t('msg.openWorkspaceFirst'));
                return;
            }
            const cfg = getConfig();
            const patterns = cfg.tailPatterns.length > 0 ? cfg.tailPatterns : ['**/*.log'];
            const exclude = '**/node_modules/**';
            const uris = new Map<string, vscode.Uri>();
            for (const pattern of patterns) {
                const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), exclude, 500);
                for (const u of found) { uris.set(u.fsPath, u); }
            }
            const list = [...uris.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
            if (list.length === 0) {
                void vscode.window.showInformationMessage(t('msg.noTailedFiles'));
                return;
            }
            const rel = (u: vscode.Uri) => vscode.workspace.asRelativePath(u, false);
            const picked = await vscode.window.showQuickPick(
                list.map((u) => ({ label: rel(u), uri: u })),
                { placeHolder: t('msg.selectTailedFile') },
            );
            if (picked?.uri) {
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(picked.uri, { tail: true });
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.deleteSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            // bug_013: Palette invocation has no target log — guide the user to the context menu.
            if (!item?.uri) {
                void vscode.window.showInformationMessage(t('msg.paletteRequiresLog'));
                return;
            }
            const answer = await vscode.window.showWarningMessage(
                t('msg.deleteFileConfirm', item.filename),
                { modal: true },
                t('action.delete'),
            );
            if (answer === t('action.delete')) {
                await vscode.workspace.fs.delete(item.uri);
                // bug_016: the direct-delete path used to skip metadata/search-index
                // cleanup, orphaning entries that then showed up as phantom sidebar
                // rows. Reuse the same helper emptyTrash relies on so this can't
                // drift out of sync again.
                await cleanupDeletedSessionMetadata(item.uri, historyProvider.getMetaStore());
                historyProvider.refresh();
            }
        }),
    ];
}

export function historyEditCommands(deps: CommandDeps): vscode.Disposable[] {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.renameSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            // bug_013: Palette invocation has no target log — guide the user to the context menu.
            if (!item?.uri) {
                void vscode.window.showInformationMessage(t('msg.paletteRequiresLog'));
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: t('msg.renameSessionPrompt'),
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_/, ''),
            });
            if (!name || name.trim() === '') { return; }
            const metaStore = historyProvider.getMetaStore();
            const newUri = await metaStore.renameLogFile(item.uri, name.trim());
            await metaStore.setDisplayName(newUri, name.trim());
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.tagSession',
          async (item: { uri: vscode.Uri }) => {
            // bug_013: Palette invocation has no target log — guide the user to the context menu.
            if (!item?.uri) {
                void vscode.window.showInformationMessage(t('msg.paletteRequiresLog'));
                return;
            }
            const meta = await historyProvider.getMetaStore().loadMetadata(item.uri);
            const input = await vscode.window.showInputBox({
                prompt: t('msg.enterTagsPrompt'),
                value: (meta.tags ?? []).join(', '),
            });
            if (input === undefined) { return; }
            const tags = input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            await historyProvider.getMetaStore().setTags(item.uri, tags);
            historyProvider.refresh();
        }),
        // Idea #7: attach a free-text note to a session (e.g. "Regression from PR #142").
        // Pre-fills the existing note so the prompt edits rather than replaces; an empty value clears it.
        vscode.commands.registerCommand('saropaLogCapture.addSessionNote',
          async (item: { uri: vscode.Uri }) => {
            // bug_013: Palette invocation has no target log — guide the user to the context menu.
            if (!item?.uri) {
                void vscode.window.showInformationMessage(t('msg.paletteRequiresLog'));
                return;
            }
            const metaStore = historyProvider.getMetaStore();
            const meta = await metaStore.loadMetadata(item.uri);
            const input = await vscode.window.showInputBox({
                prompt: t('msg.sessionNotePrompt'),
                placeHolder: t('msg.sessionNotePlaceholder'),
                value: meta.note ?? '',
            });
            if (input === undefined) { return; }
            await metaStore.setNote(item.uri, input);
            historyProvider.refresh();
            // Confirm with the actual note text (or a cleared message) so the action is never silent.
            const trimmed = input.trim();
            void vscode.window.showInformationMessage(
                trimmed === '' ? t('msg.sessionNoteCleared') : t('msg.sessionNoteSaved', trimmed),
            );
        }),
    ];
}
