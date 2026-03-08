/**
 * Bookmark handler wiring for viewer targets.
 * Extracted from viewer-handler-wiring.ts for file-length compliance.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import type { SessionManagerImpl } from "../../modules/session/session-manager";
import type { ViewerBroadcaster } from "./viewer-broadcaster";
import type { BookmarkStore } from "../../modules/storage/bookmark-store";

/** Subset of HandlerTarget needed for bookmark wiring. */
interface BookmarkHandlerTarget {
    setAddBookmarkHandler(h: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void): void;
    setBookmarkActionHandler(h: (msg: Record<string, unknown>) => void): void;
}

/** Dependencies for bookmark handler wiring. */
export interface BookmarkHandlerDeps {
    readonly sessionManager: SessionManagerImpl;
    readonly broadcaster: ViewerBroadcaster;
    readonly bookmarkStore: BookmarkStore;
    readonly onOpenBookmark?: (fileUri: string, lineIndex: number) => void;
}

/** Wire bookmark-related handlers on a viewer target. */
export function wireBookmarkHandlers(target: BookmarkHandlerTarget, deps: BookmarkHandlerDeps): void {
    const { sessionManager, broadcaster, bookmarkStore } = deps;

    target.setAddBookmarkHandler((lineIndex, text, fileUri) => {
        const uri = fileUri ?? sessionManager.getActiveSession()?.fileUri;
        if (!uri) { return; }
        const filename = uri.path.split('/').pop() ?? '';
        bookmarkStore.add({ fileUri: uri.toString(), filename, lineIndex, lineText: text, note: '' });
    });
    target.setBookmarkActionHandler((msg) => {
        const type = String(msg.type ?? '');
        if (type === 'requestBookmarks') {
            broadcaster.sendBookmarkList(bookmarkStore.getAll() as Record<string, unknown>);
        } else if (type === 'deleteBookmark') {
            bookmarkStore.remove(String(msg.fileUri ?? ''), String(msg.bookmarkId ?? ''));
        } else if (type === 'deleteFileBookmarks') {
            void confirmDeleteFileBookmarks(bookmarkStore, msg);
        } else if (type === 'deleteAllBookmarks') {
            void confirmDeleteAllBookmarks(bookmarkStore);
        } else if (type === 'editBookmarkNote') {
            void promptEditBookmarkNote(bookmarkStore, msg);
        } else if (type === 'openBookmark') {
            deps.onOpenBookmark?.(String(msg.fileUri ?? ''), Number(msg.lineIndex ?? 0));
        }
    });
}

async function confirmDeleteFileBookmarks(store: BookmarkStore, msg: Record<string, unknown>): Promise<void> {
    const filename = String(msg.filename ?? 'this file');
    const answer = await vscode.window.showWarningMessage(
        t('msg.deleteBookmarksForFile', filename),
        { modal: true },
        t('action.deleteAll'),
    );
    if (answer === t('action.deleteAll')) { store.removeAllForFile(String(msg.fileUri ?? '')); }
}

async function confirmDeleteAllBookmarks(store: BookmarkStore): Promise<void> {
    const total = store.getTotalCount();
    if (total === 0) { return; }
    const answer = await vscode.window.showWarningMessage(
        t('msg.deleteAllBookmarks', String(total), total === 1 ? '' : 's'),
        { modal: true },
        t('action.deleteAll'),
    );
    if (answer === t('action.deleteAll')) { store.removeAll(); }
}

async function promptEditBookmarkNote(store: BookmarkStore, msg: Record<string, unknown>): Promise<void> {
    const note = await vscode.window.showInputBox({
        prompt: t('prompt.editBookmarkNote'),
        value: String(msg.currentNote ?? ''),
    });
    if (note === undefined) { return; }
    store.updateNote(String(msg.fileUri ?? ''), String(msg.bookmarkId ?? ''), note);
}
