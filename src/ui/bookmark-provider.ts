/** TreeDataProvider for the Bookmarks panel. */

import * as vscode from 'vscode';
import { BookmarkStore, Bookmark } from '../modules/bookmark-store';

const MAX_LABEL_LEN = 60;

/** Union of node types in the two-level bookmark tree. */
export type BookmarkTreeItem = BookmarkFileItem | BookmarkEntryItem;

/** Top-level node representing a log file that has bookmarks. */
export interface BookmarkFileItem {
  readonly type: 'file';
  readonly fileUri: string;
  readonly filename: string;
  readonly count: number;
}

/** Leaf node representing a single bookmark within a file. */
export interface BookmarkEntryItem {
  readonly type: 'bookmark';
  readonly fileUri: string;
  readonly bookmark: Bookmark;
}

/** Provides a two-level tree: files → bookmarks. */
export class BookmarkProvider
  implements vscode.TreeDataProvider<BookmarkTreeItem>, vscode.Disposable
{
  private readonly _onDidChange = new vscode.EventEmitter<BookmarkTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private filterText = '';
  private readonly sub: vscode.Disposable;

  constructor(private readonly store: BookmarkStore) {
    this.sub = store.onDidChange(() => this.refresh());
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.sub.dispose();
  }

  refresh(): void { this._onDidChange.fire(undefined); }

  /** Set a text filter. Empty string clears the filter. */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /** Returns current filter text (for display). */
  getFilter(): string { return this.filterText; }

  getTreeItem(item: BookmarkTreeItem): vscode.TreeItem {
    return item.type === 'file' ? this.fileTreeItem(item) : this.entryTreeItem(item);
  }

  getChildren(element?: BookmarkTreeItem): BookmarkTreeItem[] {
    if (element) {
      if (element.type !== 'file') { return []; }
      return this.getBookmarkEntries(element.fileUri);
    }
    return this.getFileNodes();
  }

  private getFileNodes(): BookmarkFileItem[] {
    const all = this.store.getAll();
    const nodes: BookmarkFileItem[] = [];
    for (const key of Object.keys(all)) {
      const entry = all[key];
      const filtered = this.filterBookmarks(entry.bookmarks);
      if (filtered.length === 0) { continue; }
      nodes.push({ type: 'file', fileUri: entry.fileUri, filename: entry.filename, count: filtered.length });
    }
    return nodes.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  private getBookmarkEntries(fileUri: string): BookmarkEntryItem[] {
    const bookmarks = this.store.getForFile(fileUri);
    return this.filterBookmarks(bookmarks).map(b => ({ type: 'bookmark' as const, fileUri, bookmark: b }));
  }

  private filterBookmarks(bookmarks: readonly Bookmark[]): Bookmark[] {
    if (!this.filterText) { return [...bookmarks]; }
    return bookmarks.filter(b =>
      b.lineText.toLowerCase().includes(this.filterText) ||
      b.note.toLowerCase().includes(this.filterText),
    );
  }

  private fileTreeItem(item: BookmarkFileItem): vscode.TreeItem {
    const ti = new vscode.TreeItem(item.filename, vscode.TreeItemCollapsibleState.Expanded);
    ti.description = `${item.count} bookmark${item.count === 1 ? '' : 's'}`;
    ti.iconPath = new vscode.ThemeIcon('file');
    ti.contextValue = 'bookmark-file';
    return ti;
  }

  private entryTreeItem(item: BookmarkEntryItem): vscode.TreeItem {
    const b = item.bookmark;
    const truncated = b.lineText.length > MAX_LABEL_LEN
      ? b.lineText.slice(0, MAX_LABEL_LEN) + '...'
      : b.lineText;
    const label = `L${b.lineIndex + 1}: ${truncated}`;
    const ti = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    ti.description = b.note || undefined;
    ti.tooltip = buildTooltip(b);
    ti.iconPath = new vscode.ThemeIcon(b.note ? 'comment' : 'bookmark');
    ti.command = { command: 'saropaLogCapture.openBookmark', title: 'Open', arguments: [item] };
    ti.contextValue = 'bookmark';
    return ti;
  }
}

function buildTooltip(b: Bookmark): string {
  const parts = [`Line ${b.lineIndex + 1}`];
  if (b.note) { parts.push(`Note: ${b.note}`); }
  parts.push(b.lineText);
  parts.push(`Created: ${new Date(b.createdAt).toLocaleString()}`);
  return parts.join('\n');
}
