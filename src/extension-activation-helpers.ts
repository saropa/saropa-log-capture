import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig } from './modules/config/config';
import { logExtensionInfo } from './modules/misc/extension-logger';
import { BookmarkStore } from './modules/storage/bookmark-store';
import type { LoadResultFirstError } from './ui/provider/log-viewer-provider-load';
import type { FirstErrorResult } from './modules/bookmarks/first-error';
import { isSplitGroup, getTreeItemUri, type TreeItem } from './ui/session/session-history-grouping';
import { LOG_LAST_VIEWED_KEY } from './ui/provider/viewer-provider-helpers';
import { flattenLeafSessions } from './ui/provider/viewer-log-context';

const walkthroughShownKey = 'slc.walkthroughShown';

/**
 * Session-scoped state for the smart-bookmark prompt.
 * promptedUris dedups per file (we asked once already), ignoredErrorTexts
 * dedups across files (user said "stop showing me this exact line"). Both
 * live for the VS Code window lifetime — intentionally not persisted, so a
 * reload gives the user a fresh start.
 */
export interface SmartBookmarkSession {
    readonly promptedUris: Set<string>;
    readonly ignoredErrorTexts: Set<string>;
}

/** Viewer capabilities the prompt invokes when the user picks an action. */
export interface SmartBookmarkViewer {
    scrollToLine(line: number): void;
}

type SmartBookmarkAction = 'focus' | 'copy' | 'bookmark' | 'ignore' | 'dismiss' | undefined;

function pickCandidate(loadResult: LoadResultFirstError): FirstErrorResult | undefined {
    const cfg = getConfig().smartBookmarks;
    if (cfg.suggestFirstError && loadResult.firstError) { return loadResult.firstError; }
    if (cfg.suggestFirstWarning && loadResult.firstWarning) { return loadResult.firstWarning; }
    return undefined;
}

/**
 * Surface the first error/warning in a freshly loaded log with a non-modal
 * notification that shows the full error text and 5 actions (Focus / Copy /
 * Bookmark / Ignore / Dismiss). One prompt per file per window; Ignore
 * suppresses an exact line pattern globally for the rest of the session.
 *
 * bug_004: this used to be a modal (`{ modal: true }`), which blocks the editor,
 * breakpoints, and debug toolbar until dismissed — disruptive when it fires mid
 * debug session on the very first captured error. A non-modal notification still
 * carries the same detail text and actions but never steals focus or blocks input.
 */
export async function maybeSuggestSmartBookmark(
    uri: vscode.Uri,
    loadResult: LoadResultFirstError | undefined,
    bookmarkStore: BookmarkStore,
    session: SmartBookmarkSession,
    viewer: SmartBookmarkViewer,
): Promise<void> {
    if (!loadResult) { return; }
    if (loadResult.skippedPreLaunchErrors) {
        logExtensionInfo('smartBookmark', `${loadResult.skippedPreLaunchErrors} pre-launch error(s) skipped`);
    }
    const candidate = pickCandidate(loadResult);
    if (!candidate) { return; }
    const uriStr = uri.toString();
    if (session.promptedUris.has(uriStr)) { return; }
    if (session.ignoredErrorTexts.has(candidate.lineText)) { return; }
    const existing = bookmarkStore.getForFile(uriStr);
    if (existing.some((b) => b.lineIndex === candidate.lineIndex)) { return; }
    // Mark prompted BEFORE awaiting so a second load racing in cannot double-prompt.
    session.promptedUris.add(uriStr);
    const action = await showSmartBookmarkModal(candidate);
    await runSmartBookmarkAction(action, candidate, uri, bookmarkStore, session, viewer);
}

async function showSmartBookmarkModal(candidate: FirstErrorResult): Promise<SmartBookmarkAction> {
    const lineNum = candidate.lineIndex + 1;
    const message = candidate.level === 'error'
        ? t('msg.smartBookmarkFirstError', String(lineNum))
        : t('msg.smartBookmarkFirstWarning', String(lineNum));
    const focus = t('action.focusLine');
    const copy = t('action.copy');
    const bookmark = t('action.addBookmark');
    const ignore = t('action.ignoreError');
    const dismiss = t('action.dismiss');
    // bug_004 follow-up: `MessageOptions.detail` is a modal-only field in the VS Code
    // API — a non-modal `showInformationMessage` toast silently drops it, so the error
    // line text never reached the user once the modal was removed. Fold the line text
    // into the primary message (separated so it still reads as a distinct line) instead
    // of relying on `detail`, which requires `modal: true` to render at all.
    const fullMessage = `${message}\n${candidate.lineText}`;
    const picked = await vscode.window.showInformationMessage(
        fullMessage,
        focus, copy, bookmark, ignore, dismiss,
    );
    if (picked === focus) { return 'focus'; }
    if (picked === copy) { return 'copy'; }
    if (picked === bookmark) { return 'bookmark'; }
    if (picked === ignore) { return 'ignore'; }
    if (picked === dismiss) { return 'dismiss'; }
    return undefined;
}

async function runSmartBookmarkAction(
    action: SmartBookmarkAction,
    candidate: FirstErrorResult,
    uri: vscode.Uri,
    bookmarkStore: BookmarkStore,
    session: SmartBookmarkSession,
    viewer: SmartBookmarkViewer,
): Promise<void> {
    if (action === 'focus') {
        // scrollToLine is 1-based to match the viewer's go-to-line input.
        viewer.scrollToLine(candidate.lineIndex + 1);
        return;
    }
    if (action === 'copy') {
        await vscode.env.clipboard.writeText(candidate.lineText);
        void vscode.window.showInformationMessage(t('msg.errorCopied'));
        return;
    }
    if (action === 'bookmark') {
        addBookmarkFromCandidate(uri, candidate, bookmarkStore);
        return;
    }
    if (action === 'ignore') {
        session.ignoredErrorTexts.add(candidate.lineText);
    }
}

function addBookmarkFromCandidate(uri: vscode.Uri, candidate: FirstErrorResult, bookmarkStore: BookmarkStore): void {
    const filename = uri.path.split(/[/\\]/).pop() ?? '';
    bookmarkStore.add({
        fileUri: uri.toString(),
        filename,
        lineIndex: candidate.lineIndex,
        lineText: candidate.lineText,
        note: '',
    });
    void vscode.window.showInformationMessage(t('msg.bookmarkAdded', String(candidate.lineIndex + 1)));
}

/** Command + args that open the extension's Getting Started walkthrough tab. */
function openWalkthrough(): void {
    void vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'saropa.saropa-log-capture#saropaLogCapture.getStarted',
        false,
    );
}

/**
 * Show the Getting Started walkthrough once on first install.
 *
 * bug_004: opening the walkthrough tab synchronously during activation used to steal
 * focus from a live debug session — the worst possible moment for a first-run user, who
 * is often mid-way through their first debug attempt. If a debug session is already
 * active when this would normally fire, defer via a one-time `onDidTerminateDebugSession`
 * listener so the walkthrough only appears once the user is back at idle. The "shown"
 * flag is still marked immediately so we never queue more than one deferred open.
 */
export function showWalkthroughOnFirstInstall(context: vscode.ExtensionContext): void {
    if (context.globalState.get<boolean>(walkthroughShownKey)) { return; }
    void context.globalState.update(walkthroughShownKey, true);
    if (!vscode.debug.activeDebugSession) {
        openWalkthrough();
        return;
    }
    // A debug session is running — wait for it to end before stealing the editor's focus.
    // The listener disposes itself after firing once so it never fires again for a later session.
    const listener = vscode.debug.onDidTerminateDebugSession(() => {
        listener.dispose();
        openWalkthrough();
    });
    context.subscriptions.push(listener);
}

/** Find the most recently viewed URI from the last-viewed workspace state map. */
function findLastViewedUri(lastViewedMap: Record<string, number>): string | undefined {
    let best: string | undefined;
    let bestTime = 0;
    for (const [uri, time] of Object.entries(lastViewedMap)) {
        if (time > bestTime) { bestTime = time; best = uri; }
    }
    return best;
}

/**
 * The log to reopen on startup: whichever log the user last deliberately opened, provided it still
 * exists and has not been trashed. Returns undefined to mean "no restorable choice — use the newest".
 *
 * Only explicit opens write `logLastViewed` (the Logs-panel click, `openSession`, `openLogFile`);
 * auto-loads deliberately do not. So this is the user's real last choice, not an echo of a previous
 * auto-load.
 *
 * Two lookups, and they answer different questions:
 *  - `trashed` is a SIDECAR FLAG, not a file move (`trashSession` calls `metaStore.setTrashed`; the
 *    log stays where it is). A trashed log therefore still passes `stat()`, so the flag is the ONLY
 *    thing keeping it from reopening. The leaf must be found through `flattenLeafSessions`, which
 *    descends both `SplitGroup.parts` AND `SessionGroup.members` — the last-viewed map records the
 *    part or member the user actually opened, never the synthetic parent. A shallower lookup finds
 *    no leaf for a nested member, reads no flag, and reopens a trashed log.
 *  - Existence is a `stat`, not tree membership: `openLogFile` can load a file from ANYWHERE, and
 *    such a file never appears in the reports-directory scan. Requiring tree membership (as the old
 *    resume banner did) silently dropped exactly those files. Absent from the tree is normal here.
 */
async function resolveRestoreUri(
    context: vscode.ExtensionContext,
    items: readonly TreeItem[],
): Promise<vscode.Uri | undefined> {
    const lastViewedMap = context.workspaceState.get<Record<string, number>>(LOG_LAST_VIEWED_KEY, {});
    const lastViewedUriStr = findLastViewedUri(lastViewedMap);
    if (!lastViewedUriStr) { return undefined; }
    const leaf = flattenLeafSessions(items).find(l => l.uri.toString() === lastViewedUriStr);
    if (leaf?.trashed) { return undefined; }
    const uri = vscode.Uri.parse(lastViewedUriStr);
    // A remembered file can be deleted, renamed, or live on a drive that is no longer mounted.
    // stat() failing is the normal case for a stale entry, not an error worth surfacing.
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        return undefined;
    }
    return uri;
}

/** Auto-load deps: viewer provider and a function to post messages to it. */
export interface AutoLoadTarget {
    getCurrentFileUri(): vscode.Uri | undefined;
    loadFromFile(uri: vscode.Uri): Promise<void>;
    postMessage(msg: unknown): void;
}

/**
 * Open a log in the viewer on first visit: the last-viewed one when it can be restored, else the
 * newest non-trashed session. Called after the session list streaming fetch completes — items are
 * already loaded, so the only extra I/O is one stat() of the remembered URI.
 *
 * Restoring rather than always jumping to newest is the point (plan 111): a window reload used to
 * discard whichever log the user was reading. When a newer log does exist, the unified log status
 * bar surfaces it (refreshLogContext runs on every load), so nothing is hidden by staying put.
 */
export async function autoLoadInitialLog(
    context: vscode.ExtensionContext,
    items: readonly TreeItem[],
    target: AutoLoadTarget,
): Promise<void> {
    const restoreUri = await resolveRestoreUri(context, items);
    // The caller checked "nothing open yet" BEFORE this function's stat() await. A live session
    // starting, or the webview's pending-load path (log-viewer-provider-setup.ts), can land during
    // that await — and this is a first-visit convenience, so it must never overwrite a log that a
    // more deliberate path has already opened. Re-check once the await has resolved.
    if (target.getCurrentFileUri()) { return; }
    if (restoreUri) {
        void target.loadFromFile(restoreUri);
        return;
    }
    const latest = items.find(i => isSplitGroup(i) || !i.trashed);
    if (!latest) { return; }
    void target.loadFromFile(getTreeItemUri(latest));
}
