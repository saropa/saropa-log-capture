/** Bookmark persistence layer backed by workspaceState. */

import * as vscode from 'vscode';

const BOOKMARKS_KEY = 'slc.bookmarks';
const MAX_LINE_TEXT = 200;
let idCounter = 0;

/** A single bookmarked line. */
export interface Bookmark {
  readonly id: string;
  readonly lineIndex: number;
  readonly lineText: string;
  readonly note: string;
  readonly createdAt: number;
}

/** All bookmarks for one log file. */
export interface FileBookmarks {
  readonly fileUri: string;
  readonly filename: string;
  readonly bookmarks: Bookmark[];
}

/** CRUD operations for bookmarks, persisted via workspaceState. */
export class BookmarkStore implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  dispose(): void { this._onDidChange.dispose(); }

  /** Add a bookmark for a line in the given file. */
  add(fileUri: string, filename: string, lineIndex: number, lineText: string, note: string): void {
    const map = this.load();
    const entry = map[fileUri] ?? { fileUri, filename, bookmarks: [] as Bookmark[] };
    const trimmed = lineText.length > MAX_LINE_TEXT ? lineText.slice(0, MAX_LINE_TEXT) + '...' : lineText;
    const newBookmark: Bookmark = {
      id: `${Date.now()}-${++idCounter}`,
      lineIndex,
      lineText: trimmed,
      note,
      createdAt: Date.now(),
    };
    map[fileUri] = { ...entry, bookmarks: [...entry.bookmarks, newBookmark] };
    this.save(map);
  }

  /** Remove a single bookmark by id. */
  remove(fileUri: string, bookmarkId: string): void {
    const map = this.load();
    const entry = map[fileUri];
    if (!entry) { return; }
    const filtered = entry.bookmarks.filter(b => b.id !== bookmarkId);
    if (filtered.length === 0) {
      delete map[fileUri];
    } else {
      map[fileUri] = { ...entry, bookmarks: filtered };
    }
    this.save(map);
  }

  /** Update the note on an existing bookmark. */
  updateNote(fileUri: string, bookmarkId: string, note: string): void {
    const map = this.load();
    const entry = map[fileUri];
    if (!entry) { return; }
    map[fileUri] = {
      ...entry,
      bookmarks: entry.bookmarks.map(b => b.id === bookmarkId ? { ...b, note } : b),
    };
    this.save(map);
  }

  /** Remove all bookmarks for one file. */
  removeAllForFile(fileUri: string): void {
    const map = this.load();
    if (!map[fileUri]) { return; }
    delete map[fileUri];
    this.save(map);
  }

  /** Remove every bookmark. */
  removeAll(): void { this.save({}); }

  /** Get bookmarks for a single file (empty array if none). */
  getForFile(fileUri: string): readonly Bookmark[] {
    return this.load()[fileUri]?.bookmarks ?? [];
  }

  /** Get all file bookmark entries. */
  getAll(): Record<string, FileBookmarks> { return this.load(); }

  /** Total bookmark count across all files. */
  getTotalCount(): number {
    const map = this.load();
    let total = 0;
    for (const key of Object.keys(map)) { total += map[key].bookmarks.length; }
    return total;
  }

  private load(): Record<string, FileBookmarks> {
    return this.context.workspaceState.get<Record<string, FileBookmarks>>(BOOKMARKS_KEY, {});
  }

  private save(map: Record<string, FileBookmarks>): void {
    void this.context.workspaceState.update(BOOKMARKS_KEY, map);
    this._onDidChange.fire();
  }
}
