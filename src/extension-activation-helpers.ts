import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig } from './modules/config/config';
import { BookmarkStore } from './modules/storage/bookmark-store';
import type { LoadResultFirstError } from './ui/provider/log-viewer-provider-load';
import type { FirstErrorResult } from './modules/bookmarks/first-error';
import { isSplitGroup, getTreeItemUri, type TreeItem } from './ui/session/session-history-grouping';
import { LOG_LAST_VIEWED_KEY } from './ui/provider/viewer-provider-helpers';

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
 * Surface the first error/warning in a freshly loaded log with a modal that
 * shows the full error text and 5 actions (Focus / Copy / Bookmark / Ignore /
 * Dismiss). One prompt per file per window; Ignore suppresses an exact line
 * pattern globally for the rest of the session.
 */
export async function maybeSuggestSmartBookmark(
    uri: vscode.Uri,
    loadResult: LoadResultFirstError | undefined,
    bookmarkStore: BookmarkStore,
    session: SmartBookmarkSession,
    viewer: SmartBookmarkViewer,
): Promise<void> {
    if (!loadResult) { return; }
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
    const picked = await vscode.window.showInformationMessage(
        message,
        { modal: true, detail: candidate.lineText },
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

/** Show the Getting Started walkthrough once on first install. */
export function showWalkthroughOnFirstInstall(context: vscode.ExtensionContext): void {
    if (context.globalState.get<boolean>(walkthroughShownKey)) { return; }
    void context.globalState.update(walkthroughShownKey, true);
    void vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'saropa.saropa-log-capture#saropaLogCapture.getStarted',
        false,
    );
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

/** Locate a tree item by leaf URI. Split groups match on any of their parts, since the last-viewed
 *  map records the part the user actually opened, never the synthetic group. */
function findItemByUri(items: readonly TreeItem[], uriStr: string): TreeItem | undefined {
    return items.find(i => {
        if (isSplitGroup(i)) { return i.parts.some(p => p.uri.toString() === uriStr); }
        return i.uri.toString() === uriStr;
    });
}

/**
 * The log to reopen on startup: whichever log the user last deliberately opened, provided it still
 * exists and has not been trashed. Returns undefined to mean "no restorable choice — use the newest".
 *
 * Only explicit opens write `logLastViewed` (the Logs-panel click, `openSession`, `openLogFile`);
 * auto-loads deliberately do not. So this is the user's real last choice, not an echo of a previous
 * auto-load.
 *
 * The existence check is a `stat`, not a lookup in `items`: `openLogFile` can load a file from
 * ANYWHERE, and such a file never appears in the reports-directory scan. Requiring tree membership
 * (as the old resume banner did) silently dropped exactly those files. When the URI IS in the tree
 * we additionally honor `trashed` — a log the user sent to trash must not come back on restart.
 */
async function resolveRestoreUri(
    context: vscode.ExtensionContext,
    items: readonly TreeItem[],
): Promise<vscode.Uri | undefined> {
    const lastViewedMap = context.workspaceState.get<Record<string, number>>(LOG_LAST_VIEWED_KEY, {});
    const lastViewedUriStr = findLastViewedUri(lastViewedMap);
    if (!lastViewedUriStr) { return undefined; }
    const item = findItemByUri(items, lastViewedUriStr);
    if (item && !isSplitGroup(item) && item.trashed) { return undefined; }
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
    if (restoreUri) {
        void target.loadFromFile(restoreUri);
        return;
    }
    const latest = items.find(i => isSplitGroup(i) || !i.trashed);
    if (!latest) { return; }
    void target.loadFromFile(getTreeItemUri(latest));
}
