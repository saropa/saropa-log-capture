import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig } from './modules/config/config';
import { BookmarkStore } from './modules/storage/bookmark-store';
import type { LoadResultFirstError } from './ui/provider/log-viewer-provider-load';
import type { FirstErrorResult } from './modules/bookmarks/first-error';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import { isSplitGroup, type TreeItem } from './ui/session/session-history-grouping';
import { LOG_LAST_VIEWED_KEY } from './ui/provider/viewer-provider-helpers';

const walkthroughShownKey = 'slc.walkthroughShown';

/**
 * Smart bookmarks: after a log loads, suggest adding a bookmark at the first error (or warning) line.
 * One suggestion per file per session; skipped if that line already has a bookmark.
 */
export async function maybeSuggestSmartBookmark(
    uri: vscode.Uri,
    loadResult: LoadResultFirstError | undefined,
    bookmarkStore: BookmarkStore,
    suggestedForUri: Set<string>,
): Promise<void> {
    if (!loadResult) { return; }
    const cfg = getConfig().smartBookmarks;
    let candidate: FirstErrorResult | undefined;
    if (cfg.suggestFirstError && loadResult.firstError) {
        candidate = loadResult.firstError;
    } else if (cfg.suggestFirstWarning && loadResult.firstWarning) {
        candidate = loadResult.firstWarning;
    } else {
        candidate = undefined;
    }
    if (!candidate) { return; }
    const uriStr = uri.toString();
    if (suggestedForUri.has(uriStr)) { return; }
    const existing = bookmarkStore.getForFile(uriStr);
    if (existing.some((b) => b.lineIndex === candidate.lineIndex)) { return; }
    const lineNum = candidate.lineIndex + 1;
    const message = candidate.level === 'error'
        ? t('msg.smartBookmarkFirstError', String(lineNum))
        : t('msg.smartBookmarkFirstWarning', String(lineNum));
    const addLabel = t('action.addBookmark');
    const dismissLabel = t('action.dismiss');
    const choice = await vscode.window.showInformationMessage(message, addLabel, dismissLabel);
    suggestedForUri.add(uriStr);
    if (choice === addLabel) {
        const filename = uri.path.split(/[/\\]/).pop() ?? '';
        bookmarkStore.add({
            fileUri: uriStr,
            filename,
            lineIndex: candidate.lineIndex,
            lineText: candidate.lineText,
            note: '',
        });
    }
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

/** Get the URI for a tree item (first part for split groups). */
function getItemUri(item: TreeItem): vscode.Uri {
    if (isSplitGroup(item)) {
        const sorted = [...item.parts].sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
        return sorted[0].uri;
    }
    return item.uri;
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
 * If a different session was last viewed, sends a `showResumeSession` message
 * so the webview can offer a quick-switch button.
 */
export async function autoLoadLatest(
    context: vscode.ExtensionContext,
    historyProvider: SessionHistoryProvider,
    target: AutoLoadTarget,
): Promise<void> {
    const items = await historyProvider.getAllChildren();
    const latest = items.find(i => isSplitGroup(i) || !i.trashed);
    if (!latest) { return; }
    const latestUri = getItemUri(latest);
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
