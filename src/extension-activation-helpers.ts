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

/** Get the display name for a tree item. */
function getItemName(item: TreeItem): string {
    if (isSplitGroup(item)) { return item.displayName ?? item.baseFilename; }
    return item.displayName ?? item.filename;
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

/** Auto-load deps: viewer provider and a function to post messages to it. */
export interface AutoLoadTarget {
    getCurrentFileUri(): vscode.Uri | undefined;
    loadFromFile(uri: vscode.Uri): Promise<void>;
    postMessage(msg: unknown): void;
}

/**
 * Auto-load the latest log into the viewer on first visit.
 * Called after the session list streaming fetch completes — items are already loaded, no extra I/O.
 * If a different session was last viewed, sends a `showResumeSession` message
 * so the webview can offer a quick-switch button.
 */
export async function autoLoadLatest(
    context: vscode.ExtensionContext,
    items: readonly TreeItem[],
    target: AutoLoadTarget,
): Promise<void> {
    const latest = items.find(i => isSplitGroup(i) || !i.trashed);
    if (!latest) { return; }
    const latestUri = getTreeItemUri(latest);
    void target.loadFromFile(latestUri);
    // Offer resume if a different session was last viewed.
    const lastViewedMap = context.workspaceState.get<Record<string, number>>(LOG_LAST_VIEWED_KEY, {});
    const lastViewedUriStr = findLastViewedUri(lastViewedMap);
    if (!lastViewedUriStr || lastViewedUriStr === latestUri.toString()) { return; }
    const lastItem = items.find(i => {
        if (isSplitGroup(i)) { return i.parts.some(p => p.uri.toString() === lastViewedUriStr); }
        return i.uri.toString() === lastViewedUriStr;
    });
    if (!lastItem) { return; }
    target.postMessage({
        type: 'showResumeSession',
        uriString: lastViewedUriStr,
        name: getItemName(lastItem),
    });
}
