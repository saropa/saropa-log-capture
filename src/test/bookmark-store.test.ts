import * as assert from 'assert';
import { BookmarkStore, Bookmark, FileBookmarks } from '../modules/bookmark-store';

/** Minimal mock of vscode.ExtensionContext.workspaceState. */
function mockContext(): { workspaceState: { get: (k: string, d: unknown) => unknown; update: (k: string, v: unknown) => Promise<void> } } {
    let store: Record<string, unknown> = {};
    return {
        workspaceState: {
            get: (_k: string, d: unknown) => store[_k] ?? d,
            update: async (_k: string, v: unknown) => { store[_k] = v; },
        },
    };
}

suite('BookmarkStore', () => {

    test('should add a bookmark', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///test.log', 'test.log', 5, 'Error line', 'my note');
        const bookmarks = bs.getForFile('file:///test.log');
        assert.strictEqual(bookmarks.length, 1);
        assert.strictEqual(bookmarks[0].lineIndex, 5);
        assert.strictEqual(bookmarks[0].lineText, 'Error line');
        assert.strictEqual(bookmarks[0].note, 'my note');
    });

    test('should add multiple bookmarks to the same file', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'Line 1', '');
        bs.add('file:///a.log', 'a.log', 10, 'Line 10', 'note');
        assert.strictEqual(bs.getForFile('file:///a.log').length, 2);
        assert.strictEqual(bs.getTotalCount(), 2);
    });

    test('should add bookmarks across multiple files', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'Line', '');
        bs.add('file:///b.log', 'b.log', 2, 'Line', '');
        assert.strictEqual(Object.keys(bs.getAll()).length, 2);
        assert.strictEqual(bs.getTotalCount(), 2);
    });

    test('should remove a single bookmark by id', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'First', '');
        bs.add('file:///a.log', 'a.log', 2, 'Second', '');
        const id = bs.getForFile('file:///a.log')[0].id;
        bs.remove('file:///a.log', id);
        assert.strictEqual(bs.getForFile('file:///a.log').length, 1);
        assert.strictEqual(bs.getForFile('file:///a.log')[0].lineText, 'Second');
    });

    test('should remove file entry when last bookmark is deleted', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'Only', '');
        const id = bs.getForFile('file:///a.log')[0].id;
        bs.remove('file:///a.log', id);
        assert.strictEqual(bs.getForFile('file:///a.log').length, 0);
        assert.strictEqual(Object.keys(bs.getAll()).length, 0);
    });

    test('should remove all bookmarks for a file', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'One', '');
        bs.add('file:///a.log', 'a.log', 2, 'Two', '');
        bs.add('file:///b.log', 'b.log', 3, 'Other', '');
        bs.removeAllForFile('file:///a.log');
        assert.strictEqual(bs.getForFile('file:///a.log').length, 0);
        assert.strictEqual(bs.getForFile('file:///b.log').length, 1);
    });

    test('should remove all bookmarks', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'One', '');
        bs.add('file:///b.log', 'b.log', 2, 'Two', '');
        bs.removeAll();
        assert.strictEqual(bs.getTotalCount(), 0);
        assert.strictEqual(Object.keys(bs.getAll()).length, 0);
    });

    test('should update a bookmark note', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'Line', 'old note');
        const id = bs.getForFile('file:///a.log')[0].id;
        bs.updateNote('file:///a.log', id, 'new note');
        assert.strictEqual(bs.getForFile('file:///a.log')[0].note, 'new note');
    });

    test('should truncate long line text', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        const longText = 'A'.repeat(300);
        bs.add('file:///a.log', 'a.log', 0, longText, '');
        const stored = bs.getForFile('file:///a.log')[0];
        assert.ok(stored.lineText.length <= 203); // 200 + '...'
        assert.ok(stored.lineText.endsWith('...'));
    });

    test('should return empty array for unknown file', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        assert.strictEqual(bs.getForFile('file:///nonexistent.log').length, 0);
    });

    test('should generate unique ids', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.add('file:///a.log', 'a.log', 1, 'A', '');
        bs.add('file:///a.log', 'a.log', 2, 'B', '');
        const [a, b] = bs.getForFile('file:///a.log');
        assert.notStrictEqual(a.id, b.id);
    });

    test('should be a no-op when removing from nonexistent file', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        bs.remove('file:///nope.log', 'fake-id');
        bs.removeAllForFile('file:///nope.log');
        assert.strictEqual(bs.getTotalCount(), 0);
    });

    test('should fire onDidChange when bookmarks change', () => {
        const ctx = mockContext();
        const bs = new BookmarkStore(ctx as never);
        let fireCount = 0;
        bs.onDidChange(() => { fireCount++; });
        bs.add('file:///a.log', 'a.log', 1, 'Line', '');
        bs.removeAll();
        assert.strictEqual(fireCount, 2);
    });

    test('Bookmark interface should hold expected fields', () => {
        const b: Bookmark = { id: '1', lineIndex: 0, lineText: 'text', note: '', createdAt: 123 };
        assert.strictEqual(b.id, '1');
        assert.strictEqual(b.lineIndex, 0);
        assert.strictEqual(b.lineText, 'text');
        assert.strictEqual(b.note, '');
        assert.strictEqual(b.createdAt, 123);
    });

    test('FileBookmarks interface should hold expected fields', () => {
        const fb: FileBookmarks = {
            fileUri: 'file:///a.log',
            filename: 'a.log',
            bookmarks: [],
        };
        assert.strictEqual(fb.fileUri, 'file:///a.log');
        assert.strictEqual(fb.filename, 'a.log');
        assert.strictEqual(fb.bookmarks.length, 0);
    });
});
