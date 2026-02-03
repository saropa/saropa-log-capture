/** Bookmark command registrations. */

import * as vscode from 'vscode';
import type { BookmarkStore } from './modules/bookmark-store';
import type { BookmarkProvider, BookmarkEntryItem, BookmarkFileItem } from './ui/bookmark-provider';
import type { LogViewerProvider } from './ui/log-viewer-provider';

/** Dependencies for bookmark commands. */
export interface BookmarkCommandDeps {
  readonly bookmarkStore: BookmarkStore;
  readonly bookmarkProvider: BookmarkProvider;
  readonly viewerProvider: LogViewerProvider;
}

/** Register bookmark-related commands. Returns disposables. */
export function bookmarkCommands(deps: BookmarkCommandDeps): vscode.Disposable[] {
  const { bookmarkStore, bookmarkProvider, viewerProvider } = deps;
  return [
    vscode.commands.registerCommand('saropaLogCapture.openBookmark',
      async (item: BookmarkEntryItem) => {
        if (!item?.fileUri) { return; }
        const uri = vscode.Uri.parse(item.fileUri);
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
        await viewerProvider.loadFromFile(uri);
        viewerProvider.scrollToLine(item.bookmark.lineIndex + 1);
      }),
    vscode.commands.registerCommand('saropaLogCapture.deleteBookmark',
      async (item: BookmarkEntryItem) => {
        if (!item?.bookmark) { return; }
        const answer = await vscode.window.showWarningMessage(
          `Delete bookmark on line ${item.bookmark.lineIndex + 1}?`, { modal: true }, 'Delete',
        );
        if (answer === 'Delete') {
          bookmarkStore.remove(item.fileUri, item.bookmark.id);
        }
      }),
    vscode.commands.registerCommand('saropaLogCapture.deleteFileBookmarks',
      async (item: BookmarkFileItem) => {
        if (!item?.fileUri) { return; }
        const answer = await vscode.window.showWarningMessage(
          `Delete all bookmarks for ${item.filename}?`, { modal: true }, 'Delete All',
        );
        if (answer === 'Delete All') {
          bookmarkStore.removeAllForFile(item.fileUri);
        }
      }),
    vscode.commands.registerCommand('saropaLogCapture.deleteAllBookmarks', async () => {
      const total = bookmarkStore.getTotalCount();
      if (total === 0) {
        vscode.window.showInformationMessage('No bookmarks to delete.');
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Delete all ${total} bookmark${total === 1 ? '' : 's'}?`, { modal: true }, 'Delete All',
      );
      if (answer === 'Delete All') {
        bookmarkStore.removeAll();
      }
    }),
    vscode.commands.registerCommand('saropaLogCapture.editBookmarkNote',
      async (item: BookmarkEntryItem) => {
        if (!item?.bookmark) { return; }
        const note = await vscode.window.showInputBox({
          prompt: `Edit note for bookmark on line ${item.bookmark.lineIndex + 1}`,
          value: item.bookmark.note,
        });
        if (note === undefined) { return; }
        bookmarkStore.updateNote(item.fileUri, item.bookmark.id, note);
      }),
    vscode.commands.registerCommand('saropaLogCapture.searchBookmarks', async () => {
      const text = await vscode.window.showInputBox({
        prompt: 'Filter bookmarks by line text or note',
        placeHolder: 'Type to filter (empty to clear)',
        value: bookmarkProvider.getFilter(),
      });
      if (text !== undefined) { bookmarkProvider.setFilter(text); }
    }),
    vscode.commands.registerCommand('saropaLogCapture.refreshBookmarks', () => {
      bookmarkProvider.setFilter('');
      bookmarkProvider.refresh();
    }),
  ];
}
