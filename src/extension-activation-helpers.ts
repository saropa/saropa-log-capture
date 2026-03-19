import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig } from './modules/config/config';
import { BookmarkStore } from './modules/storage/bookmark-store';
import type { LoadResultFirstError } from './ui/provider/log-viewer-provider-load';
import type { FirstErrorResult } from './modules/bookmarks/first-error';

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
